# ---------------------------------------------------------------------------
# Compute — exactly ONE Always Free AMD micro instance.
# The micro shape's service limit is per availability domain (this tenancy:
# AD-1 = 0, AD-2 = 0, AD-3 = 2) — so the AD is selectable, defaulting to the
# first. Set availability_domain_name in terraform.tfvars when another AD
# holds the free slot.
# ---------------------------------------------------------------------------

data "oci_identity_availability_domains" "ads" {
  # ADs are tenancy-scoped → always query with the tenancy OCID.
  compartment_id = var.tenancy_ocid
}

locals {
  availability_domain = var.availability_domain_name != "" ? var.availability_domain_name : data.oci_identity_availability_domains.ads.availability_domains[0].name
}

# Newest Canonical Ubuntu 24.04 image that matches the micro shape (the
# shape filter rules out aarch64 variants, so we stay on amd64).
data "oci_core_images" "ubuntu" {
  compartment_id           = local.compartment
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "coop" {
  availability_domain = local.availability_domain
  compartment_id      = local.compartment
  display_name        = var.instance_display_name
  shape               = var.instance_shape

  lifecycle {
    precondition {
      condition     = contains(data.oci_identity_availability_domains.ads.availability_domains[*].name, local.availability_domain)
      error_message = "availability_domain_name must be one of this tenancy's ADs (the micro limit is granted per AD)."
    }
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_in_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.coop.id
    display_name     = "coop-vnic"
    hostname_label   = "coop"
    assign_public_ip = true # ephemeral public IP — free
  }

  metadata = {
    ssh_authorized_keys = file(pathexpand(var.ssh_public_key_path))
  }

  # Boot volume is deleted with the instance (keeps total usage inside the
  # 200 GB Always Free allowance when the stack is ever rebuilt).
  preserve_boot_volume = false

  timeouts {
    create = "20m"
    update = "10m"
    delete = "15m"
  }
}
