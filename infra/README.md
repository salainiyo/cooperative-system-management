# Infrastructure — OCI Always Free (Terraform + Ansible)

Provisions and configures **one `$0/month` Oracle Cloud AMD micro instance**
(1/8 OCPU, 1 GB RAM, 50 GB boot) and runs the Docker Compose stack on it.

```
infra/
  terraform/   cloud resources + generated Ansible inventory  (see terraform/README.md)
  ansible/     OS hardening, swap, Docker, stack deploy, DuckDNS, backups
```

## Prerequisites

- `terraform` ≥ 1.5 and `ansible-core` ≥ 2.16 locally
- An OCI account with an **API signing key** — Phase 0 steps are in
  [`terraform/README.md`](terraform/README.md) (tenancy OCID, user OCID,
  fingerprint, private key)
- An **HCP Terraform** account (free tier) for remote state — see
  [Remote state](terraform/README.md#remote-state--hcp-terraform-free-tier)

## 1. Terraform — create the instance

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in the 5 OCI values
terraform init
terraform plan
terraform apply                                 # ~3 min → writes inventory for Ansible
terraform output public_ip
```

Free-tier guardrails are enforced as variable validations: requesting any
shape other than `VM.Standard.E2.1.Micro`, or a boot volume outside
47–200 GB, fails at `plan` instead of billing you.

State lives on **HCP Terraform** (free tier, workspace `coop-oci`) with
locking and version history — never on this laptop or the managed VM. CI
runs `terraform plan` on every change under `infra/terraform/` and posts the
diff to the GitHub Actions job summary; applies stay local and manual.

## 2. Vault — the three secrets

```bash
cd infra/ansible
cp inventory/group_vars/all/vault.yml.example inventory/group_vars/all/vault.yml
# edit: SECRET_KEY      → openssl rand -hex 32
#       POSTGRES_PASSWORD → openssl rand -hex 16
#       DUCKDNS_TOKEN   → from https://www.duckdns.org
ansible-vault encrypt inventory/group_vars/all/vault.yml     # pick and store a vault password
```

`inventory/group_vars/all/vault.yml`, `inventory/hosts.yml` (written by Terraform) and all
Terraform state are gitignored — only the `.example` files are committed.

## 3. Ansible — harden and deploy

```bash
cd infra/ansible                                 # ansible.cfg picks up inventory/hosts.yml
ansible-playbook playbooks/site.yml -v           # prompts for the vault password
```

Idempotent; re-run any time. The playbook:

| Role | What it does |
|---|---|
| `common` | apt upgrades, ufw (22/80/443), fail2ban, sshd key-only drop-in, unattended-upgrades, sysctl |
| `swap` | 2 GB `/swapfile` (the 1 GB instance's safety margin) |
| `docker` | `docker.io` + `docker-compose-v2` from Ubuntu archives, log rotation |
| `deploy` | renders `/srv/coop` (`.env`, `Caddyfile`, compose files), pulls **public** images, `up -d`, waits for Postgres health, verifies all 5 containers |
| `duckdns` | points `ikimina.duckdns.org` at the instance's public IP now + every 5 min (ephemeral IP) |
| `backup` | daily `pg_dump` at 03:30 → `/var/backups/coop/`, 7-day rotation |

## 4. Verify

```bash
curl -I https://ikimina.duckdns.org            # Caddy obtains the Let's Encrypt cert on first hit
curl -s https://ikimina.duckdns.org/api/openapi.json | head -c 100
ssh -i ~/.ssh/<key> ubuntu@$(terraform -chdir=../terraform output -raw public_ip) \
    'cd /srv/coop && docker compose -f docker-compose.yml -f docker-compose.oci.yml ps'
```

Then bootstrap the first admin against the public URL:

```bash
curl -X POST https://ikimina.duckdns.org/api/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourcoop.rw","password":"choose-a-strong-password"}'
```

## Day-2 operations

```bash
# Deploy a new build (merge to main → CI publishes images → then:)
ansible-playbook playbooks/site.yml -v

# Pin/rollback: set image_tag (e.g. "sha-ab8c70f") in inventory/group_vars/all/settings.yml
ansible-playbook playbooks/site.yml -v

# Backup status / manual backup
ssh ubuntu@<ip> 'sudo ls -la /var/backups/coop'
ssh ubuntu@<ip> 'sudo /usr/local/bin/coop-pg-backup.sh'

# Teardown everything ($0 either way)
terraform -chdir=infra/terraform destroy
```
