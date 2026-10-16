# Credentials come from terraform.tfvars (gitignored). See README.md for
# how to create the API signing key and collect the OCIDs.
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = pathexpand(var.private_key_path)
  region           = var.region
}

locals {
  # Default: build everything in the root (tenancy) compartment.
  compartment = var.compartment_ocid != "" ? var.compartment_ocid : var.tenancy_ocid
}
