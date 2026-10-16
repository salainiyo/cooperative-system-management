# ---------------------------------------------------------------------------
# Network — minimal public VCN. Everything here is Always Free:
# VCN, subnet, internet gateway, route table, security list, ephemeral IP.
# Deliberately NOT used (they bill): NAT gateway, load balancer, services
# gateway, private subnet + second NIC.
# ---------------------------------------------------------------------------

resource "oci_core_vcn" "coop" {
  compartment_id = local.compartment
  display_name   = "coop-vcn"
  cidr_blocks    = [var.vcn_cidr]
  dns_label      = "coopvcn"
}

resource "oci_core_internet_gateway" "coop" {
  compartment_id = local.compartment
  vcn_id         = oci_core_vcn.coop.id
  display_name   = "coop-igw"
  enabled        = true
}

resource "oci_core_route_table" "coop" {
  compartment_id = local.compartment
  vcn_id         = oci_core_vcn.coop.id
  display_name   = "coop-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.coop.id
  }
}

resource "oci_core_security_list" "coop" {
  compartment_id = local.compartment
  vcn_id         = oci_core_vcn.coop.id
  display_name   = "coop-sl"

  # SSH, HTTP (ACME challenge + redirect) and HTTPS from anywhere.
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Free intra-VCN traffic (keeps the door open for the optional 2nd free
  # micro instance if you ever split the database off — still $0).
  ingress_security_rules {
    protocol = "all"
    source   = var.vcn_cidr
  }

  # ICMP from within the VCN (path MTU / diagnostics).
  ingress_security_rules {
    protocol = "1" # ICMP
    source   = var.vcn_cidr
    icmp_options {
      type = 3
      code = 4
    }
  }

  egress_security_rules {
    protocol         = "all"
    destination      = "0.0.0.0/0"
    destination_type = "CIDR_BLOCK"
  }
}

resource "oci_core_subnet" "coop" {
  compartment_id             = local.compartment
  vcn_id                     = oci_core_vcn.coop.id
  display_name               = "coop-subnet"
  cidr_block                 = var.subnet_cidr
  dns_label                  = "coop"
  route_table_id             = oci_core_route_table.coop.id
  security_list_ids          = [oci_core_security_list.coop.id]
  prohibit_public_ip_on_vnic = false # public IP = free with Always Free
}
