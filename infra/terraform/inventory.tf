# Terraform writes the Ansible inventory — no glue scripts needed.
# (File is gitignored: it contains the instance's public IP.)
resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory/hosts.yml"
  file_permission = "0600"

  content = <<-EOT
    all:
      hosts:
        coop_vm:
          ansible_host: ${oci_core_instance.coop.public_ip}
          ansible_user: ubuntu
          ansible_ssh_private_key_file: ${var.ssh_private_key_path}
  EOT
}
