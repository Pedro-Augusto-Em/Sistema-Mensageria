# Script para gerenciar Cloudflare Tunnel
# Uso: .\cloudflare-tunnel.ps1 [start|stop|status|install]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "status", "install", "create")]
    [string]$Action
)

# Função para verificar se o cloudflared está instalado
function Test-CloudflaredInstalled {
    try {
        $null = Get-Command cloudflared -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Função para instalar cloudflared
function Install-Cloudflared {
    Write-Host "Instalando Cloudflare Tunnel CLI..." -ForegroundColor Yellow
    
    # Baixar e instalar cloudflared para Windows
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $installPath = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
    
    # Criar diretório se não existir
    if (!(Test-Path "$env:LOCALAPPDATA\cloudflared")) {
        New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\cloudflared" -Force
    }
    
    # Baixar cloudflared
    Write-Host "Baixando cloudflared..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installPath
    
    # Adicionar ao PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath -notlike "*cloudflared*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$env:LOCALAPPDATA\cloudflared", "User")
        Write-Host "Cloudflared adicionado ao PATH. Reinicie o terminal para aplicar as mudanças." -ForegroundColor Green
    }
    
    Write-Host "Cloudflared instalado com sucesso em: $installPath" -ForegroundColor Green
}

# Função para criar um novo túnel
function New-CloudflareTunnel {
    Write-Host "Criando novo túnel Cloudflare..." -ForegroundColor Yellow
    
    if (!(Test-CloudflaredInstalled)) {
        Write-Host "Cloudflared não está instalado. Execute 'install' primeiro." -ForegroundColor Red
        return
    }
    
    # Autenticar com Cloudflare
    Write-Host "Autenticando com Cloudflare..." -ForegroundColor Yellow
    cloudflared tunnel login
    
    # Criar novo túnel
    Write-Host "Criando túnel..." -ForegroundColor Yellow
    $tunnelName = Read-Host "Digite um nome para o túnel"
    cloudflared tunnel create $tunnelName
    
    Write-Host "Túnel criado com sucesso!" -ForegroundColor Green
    Write-Host "Execute 'cloudflared tunnel list' para ver o ID do túnel." -ForegroundColor Yellow
    Write-Host "Atualize o arquivo cloudflare-tunnel.yml com o ID correto." -ForegroundColor Yellow
}

# Função para iniciar o túnel
function Start-CloudflareTunnel {
    Write-Host "Iniciando Cloudflare Tunnel..." -ForegroundColor Yellow
    
    if (!(Test-CloudflaredInstalled)) {
        Write-Host "Cloudflared não está instalado. Execute 'install' primeiro." -ForegroundColor Red
        return
    }
    
    # Verificar se o arquivo de configuração existe
    $configPath = "$env:USERPROFILE\.cloudflared\config.yml"
    if (!(Test-Path $configPath)) {
        Write-Host "Arquivo de configuração não encontrado em: $configPath" -ForegroundColor Red
        Write-Host "Execute 'create' para criar um novo túnel ou configure manualmente." -ForegroundColor Yellow
        return
    }
    
    # Iniciar o túnel
    Write-Host "Iniciando túnel com configuração: $configPath" -ForegroundColor Yellow
    cloudflared tunnel --config $configPath run
}

# Função para parar o túnel
function Stop-CloudflareTunnel {
    Write-Host "Parando Cloudflare Tunnel..." -ForegroundColor Yellow
    
    # Encontrar e parar processos do cloudflared
    $processes = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "Túnel parado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Nenhum túnel em execução encontrado." -ForegroundColor Yellow
    }
}

# Função para verificar status
function Get-CloudflareTunnelStatus {
    Write-Host "Verificando status do Cloudflare Tunnel..." -ForegroundColor Yellow
    
    if (!(Test-CloudflaredInstalled)) {
        Write-Host "Cloudflared não está instalado." -ForegroundColor Red
        return
    }
    
    # Verificar se há processos rodando
    $processes = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "Status: Túnel em execução" -ForegroundColor Green
        $processes | ForEach-Object {
            Write-Host "  PID: $($_.Id), Iniciado: $($_.StartTime)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "Status: Túnel parado" -ForegroundColor Yellow
    }
    
    # Listar túneis disponíveis
    Write-Host "`nTúneis disponíveis:" -ForegroundColor Yellow
    try {
        cloudflared tunnel list
    } catch {
        Write-Host "Erro ao listar túneis. Verifique se está autenticado." -ForegroundColor Red
    }
}

# Executar ação baseada no parâmetro
switch ($Action) {
    "install" { Install-Cloudflared }
    "create" { New-CloudflareTunnel }
    "start" { Start-CloudflareTunnel }
    "stop" { Stop-CloudflareTunnel }
    "status" { Get-CloudflareTunnelStatus }
}

Write-Host "`nPara mais informações, consulte: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/" -ForegroundColor Cyan
