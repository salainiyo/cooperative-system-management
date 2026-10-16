# Terraform — OCI Always Free (single AMD micro instance)

Provisions **exactly $0/month** of Oracle Cloud: one `VM.Standard.E2.1.Micro`
(AMD, 1/8 OCPU, 1 GB RAM), a 50 GB boot volume (of the 200 GB free allowance),
and free VCN plumbing (VCN, public subnet, internet gateway, route table,
security list with only 22/80/443 open, ephemeral public IP).

Deliberately **never** created here (these bill): NAT gateway, load balancer,
extra block volumes, flexible E4/E5 shapes, Ampere A1. The variable
validations make it *impossible* to request a non-free shape or oversized boot
volume — `terraform plan` fails instead of billing you.

---

## Phase 0 — create the OCI API signing key (one time, ~10 min)

You need four values: **tenancy OCID, user OCID, key fingerprint, private key**.

1. **Tenancy OCID** — Console (cloud.oracle.com) → **Administration →
   Tenancy details** → copy the OCID (starts `ocid1.tenancy.…`).
2. **User OCID** — **Identity → Users** → your user → copy the OCID
   (`ocid1.user.…`).
3. **API key pair** — locally:

   ```bash
   mkdir -p ~/.oci && chmod 700 ~/.oci
   openssl genrsa -out ~/.oci/oci_api_key.pem 2048
   chmod 600 ~/.oci/oci_api_key.pem
   openssl rsa -in ~/.oci/oci_api_key.pem -pubout -out ~/.oci/oci_api_key_public.pem
   ```

4. Console → **Identity → Users → your user → API Keys → Add API Key** →
   paste the contents of `oci_api_key_public.pem` (or upload the file) →
   **Add**. Copy the shown **fingerprint** (and the generated config if you
   want the CLI too — Terraform only needs the fingerprint).
5. **Region** — pick any region with the *Always Free-eligible* badge
   (e.g. `us-ashburn-1`, `eu-frankfurt-1`, `af-johannesburg-1`). Note:
   `VM.Standard.E2.1.Micro` exists in only one availability domain of a
   region — that's handled automatically.

## Run it

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # then fill in the 5 values
terraform init                                  # downloads oracle/oci provider
terraform plan                                  # review: 8-9 resources, all free
terraform apply                                 # ~3 minutes → instance up
terraform output public_ip                      # ← point DuckDNS here
```

`terraform apply` also writes the Ansible inventory to
`../ansible/inventory/hosts.yml`, so the next step is just:

```bash
cd ../ansible
ansible-playbook playbooks/site.yml             # prompts for the vault password
```

## Rollback / teardown

```bash
terraform destroy    # deletes instance (+ boot volume) and network. $0 either way.
```

Kept-on-server data lives in Docker volumes under `/srv/coop`; `destroy` only
affects cloud resources.

## Free-tier checklist (what you are using vs. the allowance)

| Item | Always Free allowance | This config |
|---|---|---|
| AMD micro instances | up to 2 × `VM.Standard.E2.1.Micro` | **1** |
| Boot volume | 200 GB total (min 47 GB each) | **50 GB** |
| VCN + subnet + IGW + routes + security list | free | 1 of each |
| Public IP | ephemeral, free | 1 |
| NAT gateway / LB / extra volumes / A1 or flex shapes | **not free** | none |
