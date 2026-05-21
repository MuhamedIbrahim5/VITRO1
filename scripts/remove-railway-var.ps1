# Remove a Railway variable (e.g. stale YOUTUBE_COOKIES_BASE64)
# $env:RAILWAY_TOKEN = "..."; powershell -File scripts\remove-railway-var.ps1 -Name YOUTUBE_COOKIES_BASE64

param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [string]$ProjectName = "vitro1",
    [string]$ServiceName = "vitro1-production"
)

$token = $env:RAILWAY_TOKEN
if (-not $token) {
    Write-Host "ERROR: Set RAILWAY_TOKEN first." -ForegroundColor Red
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
    if ($r.errors) { throw ($r.errors | ConvertTo-Json -Compress) }
    return $r.data
}

# List projects (same as redeploy script)
$listQuery = @'
query {
  projects {
    edges {
      node {
        id
        name
        environments {
          edges {
            node { id name }
          }
        }
        services {
          edges {
            node { id name }
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
$environment = $project.environments.edges.node | Where-Object { $_.name -eq "production" } | Select-Object -First 1
if (-not $environment) { $environment = $project.environments.edges.node | Select-Object -First 1 }

$deleteQuery = @'
mutation variableDelete($projectId: String!, $environmentId: String!, $name: String!) {
  variableDelete(projectId: $projectId, environmentId: $environmentId, name: $name)
}
'@

Invoke-RailwayQuery $deleteQuery @{
    projectId = $project.id
    environmentId = $environment.id
    name = $Name
} | Out-Null

Write-Host "Deleted variable: $Name from $($project.name) / $($environment.name)"
