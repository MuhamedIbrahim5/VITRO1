# Redeploy Vitro on Railway via API (needs RAILWAY_TOKEN once)
# Get token: https://railway.com/account/tokens
# Run:  $env:RAILWAY_TOKEN = "your-token-here"
#        powershell -File scripts\redeploy-railway.ps1

param(
    [string]$ProjectName = "vitro1",
    [string]$ServiceName = "vitro1-production"
)

$token = $env:RAILWAY_TOKEN
if (-not $token) {
    Write-Host "ERROR: Set RAILWAY_TOKEN first." -ForegroundColor Red
    Write-Host "  Railway -> Account Settings -> Tokens -> Create token"
    Write-Host "  Then: `$env:RAILWAY_TOKEN = '...'; powershell -File scripts\redeploy-railway.ps1"
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}
$api = "https://backboard.railway.com/graphql/v2"

function Invoke-RailwayQuery($query, $variables) {
    $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 6
    $r = Invoke-RestMethod -Uri $api -Method POST -Headers $headers -Body $body
    if ($r.errors) {
        throw ($r.errors | ConvertTo-Json -Compress)
    }
    return $r.data
}

Write-Host "Looking up Railway project/service..."

$listQuery = @'
query {
  projects {
    edges {
      node {
        id
        name
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
'@

$data = Invoke-RailwayQuery $listQuery @{}
$project = $data.projects.edges.node | Where-Object {
    $_.name -match $ProjectName -or $_.services.edges.node.name -match $ServiceName
} | Select-Object -First 1

if (-not $project) {
    Write-Host "Available projects:"
    $data.projects.edges.node | ForEach-Object { Write-Host "  - $($_.name) ($($_.id))" }
    throw "Project not found. Edit -ProjectName in this script."
}

$service = $project.services.edges.node | Where-Object { $_.name -match $ServiceName } | Select-Object -First 1
if (-not $service) {
    $service = $project.services.edges.node | Select-Object -First 1
}

$environment = $project.environments.edges.node | Where-Object { $_.name -eq "production" } | Select-Object -First 1
if (-not $environment) {
    $environment = $project.environments.edges.node | Select-Object -First 1
}

Write-Host "Project: $($project.name)"
Write-Host "Service: $($service.name) ($($service.id))"
Write-Host "Environment: $($environment.name) ($($environment.id))"
Write-Host "Redeploying..."

$redeployQuery = @'
mutation serviceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
  serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
}
'@

Invoke-RailwayQuery $redeployQuery @{
    environmentId = $environment.id
    serviceId = $service.id
} | Out-Null

Write-Host "Redeploy triggered. Wait 3-8 min then check:"
Write-Host "  https://vitro1-production-be78.up.railway.app/health"
Write-Host '  Expect: "version": "2026-05-21-youtube-fix"'
