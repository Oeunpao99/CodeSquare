"""Extra standalone Library shelves — cloud & infrastructure reference.

Imported by seed_docs.py and appended to its STANDALONE list. Self-contained
(its own small HTML helpers, majors pulled from majors.py) so there is no import
cycle with seed_docs. seed_standalone() is idempotent: these shelves are only
created if their slug is missing, so re-running seed_docs.py is safe.
"""
from majors import MAJOR_TRACKS

_MAJORS = list(MAJOR_TRACKS)


def _p(*paragraphs: str) -> str:
    return "".join(f"<p>{p}</p>" for p in paragraphs)


def _ul(*items: str) -> str:
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def _pre(code: str) -> str:
    safe = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<pre class="doc-code"><code>{safe}</code></pre>'


INFRA_SHELVES = [
    # ------------------------------------------------- Cloud Infrastructure ---
    {
        "slug": "cloud-infrastructure",
        "title": "Cloud Infrastructure",
        "description": "Rent compute, storage and networking on demand: the service models, the building blocks and the bill.",
        "icon": "☁️",
        "color": "#4B9CD3",
        "order": 210,
        "category": "devops",
        "topics": [
            {
                "title": "What the cloud actually is",
                "summary": "Someone else's computers, rented by the second, with an API in front of everything.",
                "tags": ["cloud", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Rented, on demand, API-driven</h2>"
                    + _p(
                        "A cloud provider runs data centres full of machines and lets you rent "
                        "slices of them by the second through an API. You trade capital cost and "
                        "weeks of lead time for a monthly bill and instant provisioning.",
                    )
                    + "<h3>Three service models</h3>"
                    + _ul(
                        "<strong>IaaS</strong> — raw blocks: virtual machines, disks, networks. You patch the OS.",
                        "<strong>PaaS</strong> — you push code, the platform runs it (App Service, Cloud Run).",
                        "<strong>SaaS</strong> — finished software you log into (email, CRM, this app).",
                    )
                    + "<h3>Regions and availability zones</h3>"
                    + _p(
                        "A <strong>region</strong> is a geographic location such as <code>us-east-1</code>. "
                        "Inside it are <strong>availability zones</strong> — separate buildings with "
                        "independent power and network. Spread across AZs to survive one failing; "
                        "spread across regions to survive a whole-region outage or to sit near users.",
                    )
                    + "<h3>The shared responsibility line</h3>"
                    + _p(
                        "The provider secures the hardware, hypervisor and managed services. "
                        "<em>You</em> secure your data, your OS patches on IaaS, your access policies "
                        "and your application. Know where that line sits for every service you use.",
                    )
                ),
            },
            {
                "title": "Compute: VMs, containers, serverless",
                "summary": "The same code can run on a rented machine, in a container platform, or as a function — pick by how much you want to manage.",
                "tags": ["cloud", "compute", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>A sliding scale of control vs convenience</h2>"
                    + _ul(
                        "<strong>Virtual machines</strong> — a whole OS you rent. Maximum control, "
                        "you own patching, scaling and process management. Good for legacy apps and "
                        "anything that needs a specific kernel or long-lived state.",
                        "<strong>Containers</strong> (ECS/Fargate, Cloud Run, Container Apps, Kubernetes) "
                        "— ship an image, the platform schedules and restarts it. The common default "
                        "for web services.",
                        "<strong>Serverless functions</strong> (Lambda, Cloud Functions, Azure Functions) "
                        "— upload a handler, it runs per request and scales to zero. Great for glue, "
                        "webhooks and spiky work; watch cold starts and time limits.",
                    )
                    + "<h3>Choosing</h3>"
                    + _p(
                        "Start with the most managed option that fits. Move down the stack only when "
                        "you hit a real limit — a runtime the platform won't run, a background process, "
                        "sub-millisecond latency, or a cost curve that flips at high, steady load.",
                    )
                ),
            },
            {
                "title": "Storage and databases in the cloud",
                "summary": "Object, block and file storage solve different problems; managed databases save you from running one.",
                "tags": ["cloud", "storage", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Three shapes of storage</h2>"
                    + _ul(
                        "<strong>Object</strong> (S3, Blob Storage, GCS) — key → blob over HTTP, "
                        "effectively infinite, cheap, versioned. For uploads, backups, static assets, data lakes. Not a filesystem.",
                        "<strong>Block</strong> (EBS, Managed Disks) — a raw virtual disk attached to one VM. For databases and OS volumes.",
                        "<strong>File</strong> (EFS, Azure Files) — a shared network filesystem many machines mount at once. Convenient, slower, pricier.",
                    )
                    + "<h3>Managed databases</h3>"
                    + _p(
                        "Services like RDS / Azure SQL / Cloud SQL run the engine, backups, patching "
                        "and failover for you. You still design the schema, indexes and queries. "
                        "Pick <strong>managed relational</strong> unless you have a specific reason for "
                        "a key-value or document store.",
                    )
                    + "<h3>Durability vs backups</h3>"
                    + _p(
                        "Object stores keep many copies, so hardware loss is not your worry — but "
                        "they will happily replicate a bad <code>DELETE</code>. Keep real, tested, "
                        "point-in-time backups and restore them on a schedule.",
                    )
                ),
            },
            {
                "title": "Infrastructure as Code",
                "summary": "Describe the infrastructure you want in files, review it in a PR, and let a tool make reality match.",
                "tags": ["cloud", "iac", "terraform", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Click-ops doesn't scale or reproduce</h2>"
                    + _p(
                        "Instead of creating resources by hand in a console, declare the desired state "
                        "in files (Terraform, OpenTofu, Pulumi, Bicep, CloudFormation). The tool "
                        "computes a diff and applies it. Now infrastructure is reviewable, "
                        "repeatable and recoverable.",
                    )
                    + _pre(
                        "resource \"aws_s3_bucket\" \"uploads\" {\n"
                        "  bucket = \"myapp-uploads-prod\"\n"
                        "}\n\n"
                        "# terraform plan   -> shows what will change\n"
                        "# terraform apply  -> makes it so"
                    )
                    + "<h3>Things that bite people</h3>"
                    + _ul(
                        "<strong>State</strong> — the tool records what it created. Store it remotely "
                        "(S3 + lock table, Terraform Cloud), never in Git, and never edit it by hand.",
                        "Change infra <em>only</em> through the code — a console hotfix creates drift.",
                        "Split state per environment; use variables/workspaces, not copy-paste.",
                        "Some changes force a replace (new resource, then delete) — read the plan.",
                    )
                ),
            },
            {
                "title": "Cost, quotas and the monthly bill",
                "summary": "Cloud is cheap to start and easy to overspend — the usual culprits are idle resources, data egress and oversized instances.",
                "tags": ["cloud", "cost", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Where the money goes</h2>"
                    + _ul(
                        "<strong>Compute</strong> billed per second while running — stop or scale to zero what you're not using.",
                        "<strong>Egress</strong> — data <em>leaving</em> the provider (and often between regions/AZs) costs money; inbound is usually free.",
                        "<strong>Idle managed services</strong> — a provisioned database, load balancer or NAT gateway bills 24/7 even at zero traffic.",
                        "<strong>Storage that never gets cleaned</strong> — old snapshots, unattached disks, log buckets with no lifecycle rule.",
                    )
                    + "<h3>Keep it under control</h3>"
                    + _ul(
                        "Tag every resource with owner + environment; you can't cut what you can't attribute.",
                        "Set a budget with alerts at 50/80/100%. Do this on day one.",
                        "Right-size from real metrics; prefer autoscaling to a big fixed fleet.",
                        "Commit to steady baseline load with reserved / savings plans; keep spikes on-demand or spot.",
                    )
                ),
            },
        ],
    },

    # -------------------------------------------------------------- AWS ------
    {
        "slug": "aws",
        "title": "AWS",
        "description": "Amazon Web Services: the mental model, the core compute, network, storage and database services, and a path to production.",
        "icon": "\U0001f7e7",
        "color": "#FF9900",
        "order": 211,
        "category": "devops",
        "topics": [
            {
                "title": "The AWS mental model",
                "summary": "An account is a billing + security boundary; everything lives in a region; IAM decides who can touch what.",
                "tags": ["aws", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>The pieces that frame everything else</h2>"
                    + _ul(
                        "<strong>Account</strong> — the top-level boundary for billing and isolation. "
                        "Real orgs use several (prod / staging / sandbox) under AWS Organizations.",
                        "<strong>Region</strong> — pick one close to your users; most services are "
                        "region-scoped and data does not leave it unless you move it. IAM, Route 53 and CloudFront are global.",
                        "<strong>Availability Zone</strong> — isolated infrastructure within a region; run across at least two.",
                        "<strong>IAM</strong> — identity and permissions. <em>Users</em> and <em>roles</em> "
                        "get <em>policies</em> (JSON allow/deny statements). Deny by default.",
                    )
                    + "<h3>How you talk to it</h3>"
                    + _p(
                        "Console for exploring, <code>aws</code> CLI for scripting, an SDK from code, "
                        "and Terraform/CloudFormation for anything permanent. Give humans SSO sessions "
                        "and give workloads <strong>roles</strong> — never long-lived access keys in code.",
                    )
                ),
            },
            {
                "title": "Compute: EC2, ECS/Fargate, Lambda",
                "summary": "Rent a VM (EC2), run containers without managing servers (ECS + Fargate), or run functions per-request (Lambda).",
                "tags": ["aws", "compute", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Three ways to run code</h2>"
                    + _ul(
                        "<strong>EC2</strong> — a virtual machine. You choose an instance type (family + size), "
                        "an AMI, and a security group. Put it in a private subnet behind a load balancer.",
                        "<strong>ECS on Fargate</strong> — you give it a container image and a task "
                        "definition (CPU, memory, env, IAM role); AWS runs it with no servers to patch. "
                        "The common default for web services. (EKS is the same idea with Kubernetes.)",
                        "<strong>Lambda</strong> — a function triggered by an event (HTTP via API Gateway "
                        "or a Function URL, a queue, a schedule). Scales automatically, billed per ms, "
                        "15-minute max, cold starts on the first hit.",
                    )
                    + "<h3>Picking</h3>"
                    + _p(
                        "Event-driven or spiky → Lambda. A long-running HTTP service → Fargate. "
                        "Special OS, GPU, or a licence tied to a host → EC2.",
                    )
                ),
            },
            {
                "title": "Networking: VPC, subnets, security groups, ALB, Route 53",
                "summary": "A VPC is your private network; subnets split it by AZ and public/private; security groups are per-resource firewalls.",
                "tags": ["aws", "networking", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Your slice of the network</h2>"
                    + _ul(
                        "<strong>VPC</strong> — an isolated virtual network with a CIDR block (e.g. <code>10.0.0.0/16</code>).",
                        "<strong>Subnets</strong> — CIDR slices, each pinned to one AZ. <em>Public</em> "
                        "subnets route to an Internet Gateway; <em>private</em> ones reach out via a NAT Gateway.",
                        "<strong>Security groups</strong> — stateful allow-only firewalls attached to an "
                        "ENI/instance/load balancer. Reference other security groups, not IP ranges, where you can.",
                        "<strong>Route tables</strong> — decide where a subnet's traffic goes.",
                    )
                    + "<h3>Getting traffic in</h3>"
                    + _p(
                        "An <strong>Application Load Balancer</strong> (L7) sits in the public subnets, "
                        "terminates HTTPS with an ACM certificate, and forwards to a target group of "
                        "Fargate tasks or instances in private subnets. <strong>Route 53</strong> hosts "
                        "the DNS zone; an alias record points your domain at the ALB. Use an "
                        "<strong>NLB</strong> (L4) for raw TCP/UDP or ultra-low latency.",
                    )
                ),
            },
            {
                "title": "Storage and data: S3, EBS, RDS, DynamoDB",
                "summary": "S3 for objects, EBS for a VM's disk, RDS for managed SQL, DynamoDB for serverless key-value at scale.",
                "tags": ["aws", "storage", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Match the service to the shape of the data</h2>"
                    + _ul(
                        "<strong>S3</strong> — object storage: uploads, backups, static sites, data "
                        "lakes, Athena queries. Block public access, turn on versioning, add a lifecycle "
                        "rule to expire or archive old objects.",
                        "<strong>EBS</strong> — a block volume attached to one EC2 instance; snapshot it to S3.",
                        "<strong>RDS / Aurora</strong> — managed PostgreSQL/MySQL: automated backups, "
                        "patching, Multi-AZ failover. Put it in private subnets; connect with an IAM or Secrets Manager credential.",
                        "<strong>DynamoDB</strong> — serverless key-value / document store with "
                        "single-digit-ms reads at any scale. You must design the table around your "
                        "access patterns (partition + sort key); it is not a relational database.",
                    )
                ),
            },
            {
                "title": "Deploying a web app on AWS",
                "summary": "A dependable default: Route 53 → ACM + ALB → ECS Fargate service in private subnets → RDS, with images in ECR.",
                "tags": ["aws", "deployment", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>One well-worn path</h2>"
                    + _ul(
                        "Build the container image in CI, push it to <strong>ECR</strong>.",
                        "Run it as an <strong>ECS Fargate</strong> service (2+ tasks across 2 AZs) in <strong>private</strong> subnets.",
                        "Front it with an <strong>ALB</strong> in the public subnets; HTTPS via an <strong>ACM</strong> certificate; health check a <code>/health</code> route.",
                        "<strong>Route 53</strong> alias record → the ALB.",
                        "State in <strong>RDS</strong> (Multi-AZ); secrets in <strong>Secrets Manager</strong>, injected as env vars via the task role.",
                        "Logs + metrics to <strong>CloudWatch</strong>; alarm on 5xx rate and p99 latency.",
                    )
                    + "<h3>Deploys</h3>"
                    + _p(
                        "Update the task definition with the new image tag; ECS does a rolling "
                        "replacement, waiting for new tasks to pass health checks before draining the "
                        "old ones. Keep the whole thing in Terraform so it is reproducible.",
                    )
                ),
            },
        ],
    },

    # ------------------------------------------------------------- Azure -----
    {
        "slug": "azure",
        "title": "Azure",
        "description": "Microsoft Azure: resource groups and subscriptions, the compute and networking options, identity with Entra ID, and a path to production.",
        "icon": "\U0001f537",
        "color": "#0078D4",
        "order": 212,
        "category": "devops",
        "topics": [
            {
                "title": "The Azure mental model",
                "summary": "Resources live in resource groups, inside a subscription; Entra ID is identity; Bicep/ARM is the deployment language.",
                "tags": ["azure", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>How Azure is organised</h2>"
                    + _ul(
                        "<strong>Subscription</strong> — the billing and quota boundary. Group them under a <em>management group</em> for org-wide policy.",
                        "<strong>Resource group</strong> — a folder for related resources that share a "
                        "lifecycle; deleting it deletes everything inside. Usually one per app per environment.",
                        "<strong>Region</strong> — location for a resource; some services offer "
                        "<em>availability zones</em> within a region.",
                        "<strong>Entra ID</strong> (formerly Azure AD) — the identity provider for users, "
                        "groups and workload identities; <strong>RBAC</strong> role assignments grant access at a scope.",
                    )
                    + "<h3>How you deploy</h3>"
                    + _p(
                        "Portal to explore, <code>az</code> CLI to script, and <strong>Bicep</strong> "
                        "(a readable language that compiles to ARM JSON) or Terraform for anything "
                        "lasting. Give apps a <strong>managed identity</strong> instead of storing secrets.",
                    )
                ),
            },
            {
                "title": "Compute: App Service, Container Apps, Functions, AKS, VMs",
                "summary": "From most managed to least: App Service / Functions, then Container Apps, then AKS, then plain VMs.",
                "tags": ["azure", "compute", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>The options, roughly by how little you manage</h2>"
                    + _ul(
                        "<strong>App Service</strong> — push code or a container, get HTTPS, autoscale, "
                        "slots for blue/green. The default for a straightforward web app or API.",
                        "<strong>Azure Functions</strong> — event-driven functions (HTTP, queue, timer, blob), consumption or premium plans.",
                        "<strong>Container Apps</strong> — serverless containers on Kubernetes + Dapr "
                        "under the hood, scale to zero, without running a cluster. Good for microservices and background workers.",
                        "<strong>AKS</strong> — managed Kubernetes when you genuinely need Kubernetes.",
                        "<strong>Virtual Machines</strong> (+ scale sets) — full control, full responsibility.",
                    )
                ),
            },
            {
                "title": "Networking: VNet, NSGs, Load Balancer vs Application Gateway, Azure DNS",
                "summary": "A VNet is your private network; NSGs filter traffic; use Application Gateway for HTTP, Load Balancer for L4.",
                "tags": ["azure", "networking", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>The building blocks</h2>"
                    + _ul(
                        "<strong>Virtual Network (VNet)</strong> + <strong>subnets</strong> — your address space, sliced up.",
                        "<strong>Network Security Group (NSG)</strong> — stateful allow/deny rules on a subnet or NIC.",
                        "<strong>Private Endpoint</strong> — pulls a PaaS service (Azure SQL, Storage) onto a private IP in your VNet.",
                    )
                    + "<h3>Getting traffic in — pick the right front door</h3>"
                    + _ul(
                        "<strong>Application Gateway</strong> — L7: TLS termination, path/host routing, "
                        "and a <strong>WAF</strong>. Use it for web apps.",
                        "<strong>Azure Load Balancer</strong> — L4: fast TCP/UDP distribution, no HTTP awareness.",
                        "<strong>Front Door</strong> — global anycast edge: CDN, TLS, routing and WAF across regions.",
                    )
                    + _p("<strong>Azure DNS</strong> hosts your public zone; an alias record points the domain at the gateway or Front Door.")
                ),
            },
            {
                "title": "Storage and data: Blob Storage, Azure SQL, Cosmos DB",
                "summary": "Blob for objects, Managed Disks for VM volumes, Azure SQL for managed relational, Cosmos DB for global multi-model.",
                "tags": ["azure", "storage", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Storage accounts and databases</h2>"
                    + _ul(
                        "<strong>Blob Storage</strong> — object storage inside a <em>storage account</em>; "
                        "hot / cool / archive tiers, lifecycle rules, private endpoints. For uploads, backups, static content.",
                        "<strong>Managed Disks</strong> — block volumes for VMs, with snapshots.",
                        "<strong>Azure Files</strong> — SMB/NFS shares many machines can mount.",
                        "<strong>Azure SQL Database</strong> — managed SQL Server: automated backups, "
                        "point-in-time restore, geo-replication. Also <em>Database for PostgreSQL / MySQL</em> flavours.",
                        "<strong>Cosmos DB</strong> — low-latency, globally distributed NoSQL with several "
                        "APIs (Core/SQL, Mongo, Cassandra). Priced by provisioned or autoscale RU/s; model around your queries.",
                    )
                ),
            },
            {
                "title": "Identity, RBAC and Key Vault",
                "summary": "Authenticate with Entra ID, authorize with RBAC role assignments at a scope, and let workloads use managed identities instead of secrets.",
                "tags": ["azure", "security", "identity", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Who you are, and what you can do</h2>"
                    + _p(
                        "<strong>Entra ID</strong> proves identity for users, groups, service principals "
                        "and managed identities. <strong>Azure RBAC</strong> then grants a <em>role</em> "
                        "(Reader, Contributor, or a fine-grained custom one) at a <em>scope</em> "
                        "(management group → subscription → resource group → resource). Permissions inherit downward.",
                    )
                    + "<h3>Managed identities</h3>"
                    + _p(
                        "Give an App Service / VM / Container App a <strong>managed identity</strong> and "
                        "assign it roles. Your code then gets tokens from the platform — no client "
                        "secret to store, rotate or leak.",
                    )
                    + "<h3>Key Vault</h3>"
                    + _ul(
                        "Holds secrets, keys and certificates behind RBAC + audit logging.",
                        "Apps read secrets at startup via their managed identity, or reference them directly from App Service settings.",
                        "Enable soft-delete and purge protection so a deleted key is recoverable.",
                    )
                ),
            },
        ],
    },

    # ---------------------------------------------------------- Networking ---
    {
        "slug": "networking",
        "title": "Networking",
        "description": "The fundamentals every backend and DevOps engineer needs: layers, IP addressing, TCP/UDP, routing, firewalls and how to debug them.",
        "icon": "\U0001f310",
        "color": "#6366F1",
        "order": 213,
        "category": "devops",
        "topics": [
            {
                "title": "The layers that matter (L2–L7)",
                "summary": "You mostly work at L3 (IP), L4 (TCP/UDP) and L7 (HTTP). Knowing which layer a problem is on tells you which tool to reach for.",
                "tags": ["networking", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>A working subset of the model</h2>"
                    + _ul(
                        "<strong>L2 – Link</strong> — frames on the local network, addressed by <strong>MAC</strong>. Switches, ARP, VLANs.",
                        "<strong>L3 – Network</strong> — <strong>IP</strong> packets routed between networks. Routers, subnets, <code>ping</code>.",
                        "<strong>L4 – Transport</strong> — <strong>TCP</strong> (reliable, ordered) or "
                        "<strong>UDP</strong> (fire-and-forget), addressed by <strong>port</strong>. Load balancers, firewalls, <code>ss</code>.",
                        "<strong>L7 – Application</strong> — <strong>HTTP</strong>, DNS, TLS, gRPC. Reverse proxies, API gateways, <code>curl</code>.",
                    )
                    + "<h3>Why it helps</h3>"
                    + _p(
                        "“Can I open a TCP connection but requests hang?” is an L7 problem. "
                        "“Connection refused” is L4. “No route to host” / timeout is L3. "
                        "“Name not found” is DNS. Different layer, different fix.",
                    )
                ),
            },
            {
                "title": "IP addresses, subnets and CIDR",
                "summary": "An address plus a prefix length defines a network; the prefix says how many addresses it holds.",
                "tags": ["networking", "ip", "subnet", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Reading <code>10.0.4.0/24</code></h2>"
                    + _p(
                        "The <code>/24</code> means the first 24 bits are the <strong>network</strong> "
                        "and the last 8 identify a <strong>host</strong> — so <code>2^8 = 256</code> "
                        "addresses (254 usable; first is the network, last is broadcast). "
                        "Smaller number after the slash = bigger network: <code>/16</code> is 65,536 addresses, <code>/25</code> is 128.",
                    )
                    + "<h3>Private ranges (RFC 1918)</h3>"
                    + _ul(
                        "<code>10.0.0.0/8</code>", "<code>172.16.0.0/12</code>", "<code>192.168.0.0/16</code>",
                    )
                    + _p(
                        "These are not routable on the public internet. A machine with a private IP "
                        "reaches the internet through <strong>NAT</strong> — a gateway rewrites the "
                        "source address to a shared public one and tracks the return path.",
                    )
                    + "<h3>Plan before you build</h3>"
                    + _p(
                        "Give a VPC/VNet room to grow (e.g. <code>10.0.0.0/16</code>), carve one "
                        "subnet per AZ per tier (public / app / data), and don't overlap ranges you "
                        "might later need to peer or VPN together.",
                    )
                ),
            },
            {
                "title": "TCP, UDP and ports",
                "summary": "TCP sets up a connection and guarantees delivery; UDP just sends. A port picks which process on the host.",
                "tags": ["networking", "tcp", "udp", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Two transports</h2>"
                    + _ul(
                        "<strong>TCP</strong> — three-way handshake (<code>SYN</code> / <code>SYN-ACK</code> "
                        "/ <code>ACK</code>), then an ordered, retransmitted, flow-controlled byte stream. "
                        "HTTP, SSH, databases.",
                        "<strong>UDP</strong> — no handshake, no ordering, no retransmit. Lower latency and "
                        "overhead. DNS, DHCP, QUIC/HTTP-3, video, games.",
                    )
                    + "<h3>Ports</h3>"
                    + _p(
                        "A connection is identified by the 4-tuple <em>src IP : src port → dst IP : dst "
                        "port</em>. Servers listen on well-known ports — 80 HTTP, 443 HTTPS, 22 SSH, "
                        "5432 Postgres, 6379 Redis, 53 DNS — while clients get an ephemeral high port.",
                    )
                    + "<h3>Reading connection state</h3>"
                    + _pre(
                        "ss -tlnp            # listening TCP sockets + owning process\n"
                        "ss -tnp state established\n"
                        "# TIME_WAIT piling up? expected after many short-lived client connections"
                    )
                ),
            },
            {
                "title": "Routing, NAT and firewalls",
                "summary": "A routing table decides the next hop; NAT rewrites addresses at a boundary; firewalls allow or drop by rule.",
                "tags": ["networking", "routing", "firewall", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>How a packet finds its way</h2>"
                    + _p(
                        "Each host has a <strong>routing table</strong>: “for this destination range, "
                        "send to this next hop out this interface.” Anything not matched goes to the "
                        "<strong>default gateway</strong> (<code>0.0.0.0/0</code>). Cloud subnets have "
                        "route tables you control.",
                    )
                    + "<h3>NAT</h3>"
                    + _p(
                        "A <strong>NAT gateway</strong> lets private hosts make outbound connections via "
                        "a shared public IP and blocks unsolicited inbound. Inbound to a service instead "
                        "goes through a load balancer or an explicit port forward.",
                    )
                    + "<h3>Firewalls</h3>"
                    + _ul(
                        "<strong>Stateful</strong> — allow a request out, the reply is automatically "
                        "allowed back (AWS security groups, Azure NSGs, <code>ufw</code>, most cloud firewalls).",
                        "<strong>Stateless</strong> — every packet judged alone; you must allow both "
                        "directions (AWS network ACLs).",
                        "Default deny inbound; open the narrowest port range from the narrowest source; reference groups/tags over raw CIDRs.",
                    )
                ),
            },
            {
                "title": "Diagnosing network problems",
                "summary": "Work up the layers: link → IP reachability → DNS → TCP port → TLS → HTTP response.",
                "tags": ["networking", "troubleshooting", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>A checklist, bottom to top</h2>"
                    + _pre(
                        "ip a ; ip route          # do I have an address and a default route?\n"
                        "ping 1.1.1.1             # raw IP reachability (ICMP may be blocked)\n"
                        "traceroute example.com   # where does the path stop?\n"
                        "dig example.com +short   # does the name resolve, to what?\n"
                        "nc -vz example.com 443   # is the TCP port open?\n"
                        "curl -v https://example.com/health   # TLS handshake + HTTP status + timing\n"
                        "openssl s_client -connect example.com:443 -servername example.com"
                    )
                    + "<h3>Reading the result</h3>"
                    + _ul(
                        "Resolves but <code>nc</code> fails → firewall / security group / nothing listening.",
                        "<code>nc</code> succeeds but <code>curl</code> hangs → app or TLS problem, not the network.",
                        "Works from one host, not another → compare routes, DNS resolver, and source security group.",
                        "Intermittent → look at one unhealthy backend behind the load balancer, or MTU / packet loss on a path.",
                    )
                ),
            },
        ],
    },

    # ------------------------------------------------------------ DNS Setup --
    {
        "slug": "dns",
        "title": "DNS Setup",
        "description": "Turn a domain name into a working address for your app: how resolution works, which records to set, and how to change them without downtime.",
        "icon": "\U0001f9ed",
        "color": "#22C55E",
        "order": 214,
        "category": "devops",
        "topics": [
            {
                "title": "How a name becomes an IP",
                "summary": "A resolver walks from the root to the TLD to your domain's authoritative servers, caching each answer for its TTL.",
                "tags": ["dns", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>The lookup path</h2>"
                    + _p(
                        "Your machine asks a <strong>recursive resolver</strong> (your ISP's, or "
                        "<code>1.1.1.1</code> / <code>8.8.8.8</code>). If it hasn't cached the answer it "
                        "asks a <strong>root</strong> server (→ which TLD server handles <code>.com</code>), "
                        "then the <strong>TLD</strong> server (→ which nameservers are authoritative for "
                        "<code>example.com</code>), then the <strong>authoritative</strong> nameservers for "
                        "the actual record. The answer is cached at every hop for its <strong>TTL</strong>.",
                    )
                    + "<h3>Consequences</h3>"
                    + _ul(
                        "Changes are not instant — old answers live in caches until the TTL expires.",
                        "“It works for me” can just mean your resolver cached the new value and theirs didn't.",
                        "Whoever runs your <strong>authoritative</strong> zone (Route 53, Cloudflare, Azure DNS, your registrar) is where you make changes.",
                    )
                ),
            },
            {
                "title": "The records you'll actually set",
                "summary": "A / AAAA point a name at an IP; CNAME aliases one name to another; MX routes mail; TXT carries verification and policy.",
                "tags": ["dns", "records", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>The common types</h2>"
                    + _ul(
                        "<strong>A</strong> / <strong>AAAA</strong> — name → IPv4 / IPv6 address.",
                        "<strong>CNAME</strong> — name → another name. Cannot coexist with other records "
                        "on the same name, so <em>not</em> allowed at the apex (<code>example.com</code>).",
                        "<strong>ALIAS / ANAME</strong> (provider feature: Route 53 alias, Cloudflare "
                        "CNAME-flattening, Azure alias) — CNAME-like behaviour at the apex, resolved to A/AAAA for you.",
                        "<strong>MX</strong> — mail servers for the domain, with priorities.",
                        "<strong>TXT</strong> — free text: domain-ownership verification, SPF, DKIM, DMARC.",
                        "<strong>NS</strong> — which nameservers are authoritative for the zone (set at the registrar).",
                        "<strong>CAA</strong> — which certificate authorities may issue certs for the domain.",
                    )
                ),
            },
            {
                "title": "Pointing a domain at your app",
                "summary": "Set the registrar's nameservers to your DNS host, then add records in that zone for the apex and www.",
                "tags": ["dns", "setup", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Two levels, don't confuse them</h2>"
                    + _ul(
                        "At the <strong>registrar</strong> (where you bought the domain): set the "
                        "<strong>NS</strong> records to your DNS provider's nameservers. This delegates the zone.",
                        "At the <strong>DNS provider</strong> (the hosted zone): add the actual A / CNAME / MX / TXT records.",
                    )
                    + "<h3>Apex vs www</h3>"
                    + _ul(
                        "Load balancer or platform hostname → use an <strong>ALIAS/ANAME</strong> at the "
                        "apex and a <strong>CNAME</strong> for <code>www</code> (or vice-versa), then 301-redirect one to the other.",
                        "A fixed IP → an <strong>A</strong> record at the apex.",
                    )
                    + "<h3>Certificates</h3>"
                    + _p(
                        "Most issuers (ACM, Let's Encrypt) verify control by having you add a "
                        "<strong>CNAME</strong> or <strong>TXT</strong> record. Add a <strong>CAA</strong> "
                        "record so only your issuer can mint certs.",
                    )
                ),
            },
            {
                "title": "Email records: SPF, DKIM, DMARC",
                "summary": "Three TXT-based records that tell receivers which servers may send as your domain, and what to do with ones that don't.",
                "tags": ["dns", "email", "spf", "dkim", "dmarc", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Without these, your mail lands in spam</h2>"
                    + _ul(
                        "<strong>SPF</strong> — one <code>TXT</code> at the domain listing the hosts "
                        "allowed to send: <code>v=spf1 include:_spf.google.com ~all</code>. One SPF record only; keep lookups low.",
                        "<strong>DKIM</strong> — your provider gives you a <code>TXT</code> (or CNAME) at "
                        "<code>selector._domainkey.example.com</code> holding a public key; outgoing mail is signed with the private key.",
                        "<strong>DMARC</strong> — a <code>TXT</code> at <code>_dmarc.example.com</code> "
                        "such as <code>v=DMARC1; p=reject; rua=mailto:dmarc@example.com</code>. It ties SPF/DKIM "
                        "to the visible From address and tells receivers to quarantine or reject failures.",
                    )
                    + "<h3>Rollout</h3>"
                    + _p(
                        "Start DMARC at <code>p=none</code> and read the aggregate reports for a couple "
                        "of weeks, fix any legitimate senders that fail, then move to "
                        "<code>p=quarantine</code> and finally <code>p=reject</code>.",
                    )
                ),
            },
            {
                "title": "TTL, propagation and safe cutovers",
                "summary": "Lower the TTL before a change, make the switch, watch both old and new, then raise the TTL again.",
                "tags": ["dns", "ttl", "migration", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>There is no “push” — only expiry</h2>"
                    + _p(
                        "A record's <strong>TTL</strong> is how long resolvers may cache it. To move a "
                        "domain to a new server with minimal disruption:",
                    )
                    + _ul(
                        "Days ahead: drop the TTL on the records you'll change to <code>300</code>s (5 min).",
                        "Bring the new target up and serving the same content <em>before</em> you switch.",
                        "Change the record. Keep the old target running — traffic drains off it over one TTL.",
                        "Watch logs on both sides until the old one goes quiet, then decommission and raise the TTL back to an hour+.",
                    )
                    + "<h3>Check what the world sees</h3>"
                    + _pre(
                        "dig +trace example.com          # full delegation path from the root\n"
                        "dig @1.1.1.1 example.com +short  # what one public resolver returns\n"
                        "dig @8.8.8.8 example.com +short  # compare a second resolver"
                    )
                    + _p(
                        "Common mistakes: a leftover CNAME clashing with a new A record, forgetting the "
                        "<code>www</code> variant, editing the zone at the registrar while the "
                        "nameservers point elsewhere, or an SPF/verification TXT dropped during the move.",
                    )
                ),
            },
        ],
    },

    # -------------------------------------------------------- Load Balancing -
    {
        "slug": "load-balancing",
        "title": "Load Balancing",
        "description": "Spread traffic across many backends for capacity and resilience: L4 vs L7, algorithms, health checks, draining and TLS.",
        "icon": "⚖️",
        "color": "#F59E0B",
        "order": 215,
        "category": "devops",
        "topics": [
            {
                "title": "Why put a load balancer in front",
                "summary": "One stable address, traffic spread across N backends, unhealthy ones removed automatically, and a place to terminate TLS.",
                "tags": ["load-balancing", "beginner"],
                "majors": _MAJORS,
                "body": (
                    "<h2>What it buys you</h2>"
                    + _ul(
                        "<strong>Capacity</strong> — add backends to handle more load; the client still sees one endpoint.",
                        "<strong>Resilience</strong> — a failing backend fails its health check and is pulled out; users don't notice.",
                        "<strong>Zero-downtime deploys</strong> — roll instances one at a time; the LB drains and re-adds each.",
                        "<strong>A control point</strong> — TLS termination, routing, rate limiting, WAF, access logs, metrics all in one place.",
                    )
                    + "<h3>The shape</h3>"
                    + _p(
                        "DNS points at the load balancer (itself redundant across AZs). It holds a pool "
                        "— a <em>target group</em> / <em>backend set</em> — of instances or containers, "
                        "each continuously health-checked, and forwards each new connection or request to one of the healthy ones.",
                    )
                ),
            },
            {
                "title": "L4 vs L7 load balancing",
                "summary": "L4 forwards TCP/UDP connections blind and fast; L7 understands HTTP and can route on host, path, headers and cookies.",
                "tags": ["load-balancing", "l4", "l7", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Two levels of awareness</h2>"
                    + _ul(
                        "<strong>L4</strong> (AWS NLB, Azure Load Balancer, <code>haproxy</code> in TCP "
                        "mode) — balances <em>connections</em>. No idea what's inside. Lowest latency, "
                        "handles any protocol, preserves client IP easily, can pass TLS straight through.",
                        "<strong>L7</strong> (AWS ALB, Azure Application Gateway, nginx, Envoy, Traefik) — "
                        "terminates HTTP(S) and balances <em>requests</em>. Route <code>/api</code> vs "
                        "<code>/</code>, split by <code>Host</code>, retry idempotent requests, inject "
                        "headers, do path rewrites, run a WAF.",
                    )
                    + "<h3>Which to use</h3>"
                    + _p(
                        "Default to <strong>L7</strong> for web apps and APIs — the routing and "
                        "observability are worth it. Use <strong>L4</strong> for non-HTTP protocols, "
                        "very high throughput, or when you must not terminate TLS at the edge.",
                    )
                ),
            },
            {
                "title": "Algorithms and sticky sessions",
                "summary": "Round robin and least-connections cover most cases; hashing pins a client to a backend; sticky sessions are a smell.",
                "tags": ["load-balancing", "algorithms", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>How the next request is chosen</h2>"
                    + _ul(
                        "<strong>Round robin</strong> — next backend in turn. Fine when requests cost about the same.",
                        "<strong>Least connections / least outstanding requests</strong> — send to the "
                        "least busy backend. Better when request durations vary a lot.",
                        "<strong>Hash</strong> (by client IP or a header) — the same input always maps to "
                        "the same backend. Used for cache locality or crude affinity.",
                        "<strong>Weighted</strong> — bigger instances get a larger share; also how you do canary splits.",
                    )
                    + "<h3>Sticky sessions</h3>"
                    + _p(
                        "A cookie pins a user to one backend so in-memory session state keeps working. "
                        "It also defeats even load spreading, breaks when that backend dies, and "
                        "complicates deploys. Prefer <strong>stateless</strong> backends with session "
                        "state in Redis or a signed cookie; reach for stickiness only as a stopgap.",
                    )
                ),
            },
            {
                "title": "Health checks and connection draining",
                "summary": "A health check decides in-or-out; draining lets in-flight requests finish before an instance leaves.",
                "tags": ["load-balancing", "health-checks", "intermediate"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Health checks</h2>"
                    + _ul(
                        "Point them at a real <code>/health</code> route that returns 200 only when the "
                        "app can actually serve — DB reachable, migrations applied, caches warm.",
                        "Tune <em>interval</em>, <em>timeout</em>, and the <em>healthy/unhealthy "
                        "thresholds</em>: too twitchy and a blip ejects a good node; too slow and users "
                        "hit a dead one.",
                        "Keep the health route cheap and unauthenticated, and don't have it call "
                        "downstream services you don't want to hard-depend on.",
                    )
                    + "<h3>Draining (deregistration delay)</h3>"
                    + _p(
                        "When an instance is removed — a deploy, a scale-in, a failed check — the LB "
                        "stops sending it <em>new</em> connections but lets existing ones finish for a "
                        "grace period (e.g. 30–300s). Set it a little above your longest normal request "
                        "so deploys don't cut users off mid-response.",
                    )
                ),
            },
            {
                "title": "TLS termination and the X-Forwarded-* headers",
                "summary": "Terminating TLS at the load balancer is normal — just make the app trust and read the forwarded client details.",
                "tags": ["load-balancing", "tls", "advanced"],
                "majors": _MAJORS,
                "body": (
                    "<h2>Where TLS ends</h2>"
                    + _ul(
                        "<strong>Termination</strong> — LB decrypts, forwards plain HTTP to backends on a "
                        "private network. Simple, centralises certs, lets L7 features work. Most setups.",
                        "<strong>Re-encryption</strong> — LB terminates then opens a fresh TLS connection "
                        "to the backend. Use when the backend network isn't trusted or compliance demands it.",
                        "<strong>Passthrough</strong> — L4 only; the backend terminates TLS itself.",
                    )
                    + "<h3>The forwarded headers</h3>"
                    + _p(
                        "Once TLS is terminated the backend sees the LB's IP and <code>http</code>. The "
                        "LB adds <code>X-Forwarded-For</code> (original client IP), "
                        "<code>X-Forwarded-Proto</code> (<code>https</code>) and <code>X-Forwarded-Host</code>. "
                        "Your framework must be told to trust these — e.g. uvicorn "
                        "<code>--proxy-headers --forwarded-allow-ips</code>, or Express "
                        "<code>app.set('trust proxy', ...)</code> — or redirects, rate limits and logged IPs will all be wrong.",
                    )
                    + _p(
                        "Only trust these headers from your LB's address range; strip them from raw inbound traffic.",
                    )
                ),
            },
        ],
    },
]
