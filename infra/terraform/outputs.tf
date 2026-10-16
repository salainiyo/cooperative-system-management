output "public_ip" {
  description = "Public IP of the free-tier instance (point DuckDNS here)."
  value       = oci_core_instance.coop.public_ip
}

output "instance_ocid" {
  value = oci_core_instance.coop.id
}

output "ssh_command" {
  description = "Connect with your key: ssh -i <your-private-key> ubuntu@<ip>"
  value       = "ssh ubuntu@${oci_core_instance.coop.public_ip}"
}

output "ansible_next_step" {
  value       = "cd infra/ansible && ansible-playbook playbooks/site.yml"
  description = "Run this after `terraform apply` (inventory is written automatically)."
}
