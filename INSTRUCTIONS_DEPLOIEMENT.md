# 🚀 Instructions de Déploiement - Architecture Propre

## 📋 Vue d'ensemble

Architecture finale :
```
PC Client (10.20.12.75)
    ↓
http://172.20.0.3 (port 80)
    ↓
Nginx (Reverse Proxy)
    ↓
IIS/Kestrel (localhost:5001 - interne uniquement)
```

**Principe clé** : Aucune requête directe vers le port 5001 depuis le navigateur.

## 📁 Fichiers modifiés

### Backend
- ✅ `backend/Program.cs` - CORS simplifié (une seule origine : http://172.20.0.3)
- ✅ `backend/appsettings.json` - CORS configuré pour 172.20.0.3
- ✅ `backend/Properties/launchSettings.json` - Écoute sur localhost:5001 (pas 0.0.0.0)

### Frontend  
- ✅ `frontend/public/config.js` - Configuré pour http://172.20.0.3
- ✅ **13 fichiers corrigés** - Tous utilisent maintenant `API_BASE` depuis `@/lib/config`

### Nginx
- ✅ `nginx-final.conf` - Configuration complète avec reverse proxy

## 🔧 Étapes de déploiement

### 1️⃣ Backend (IIS/Kestrel)

```powershell
# 1. Rebuild le backend avec les nouvelles configurations
cd c:\Users\mouza\OneDrive\Desktop\check-filling_managment\backend
dotnet build --configuration Release

# 2. Publier le backend
dotnet publish --configuration Release --output C:\inetpub\wwwroot\CheckFillingAPI

# 3. Redémarrer IIS ou l'application
iisreset
# OU si AppPool spécifique :
# Restart-WebAppPool -Name "NomDuAppPool"

# 4. Vérifier que le backend écoute sur localhost:5001
netstat -ano | findstr :5001
```

### 2️⃣ Frontend (Nginx)

```powershell
# 1. Rebuild le frontend
cd c:\Users\mouza\OneDrive\Desktop\check-filling_managment\frontend
npm run build

# 2. Supprimer l'ancien déploiement
Remove-Item -Path C:\nginx\html\* -Recurse -Force

# 3. Copier les nouveaux fichiers
Copy-Item -Path .\out\* -Destination C:\nginx\html\ -Recurse

# 4. Vérifier que config.js est présent
Get-Content C:\nginx\html\config.js
# Devrait afficher : window.APP_CONFIG = { API_BASE_URL: "http://172.20.0.3" }
```

### 3️⃣ Nginx (Configuration)

```powershell
# 1. Sauvegarder l'ancienne configuration
Copy-Item C:\nginx-1.28.1\conf\nginx.conf C:\nginx-1.28.1\conf\nginx.conf.backup

# 2. Copier la nouvelle configuration
Copy-Item c:\Users\mouza\OneDrive\Desktop\check-filling_managment\nginx-final.conf C:\nginx-1.28.1\conf\nginx.conf

# 3. Tester la configuration
cd C:\nginx-1.28.1
.\nginx.exe -t

# 4. Recharger Nginx (SANS interrompre les connexions)
.\nginx.exe -s reload
```

### 4️⃣ Pare-feu (Configuration)

```powershell
# Le port 5001 doit être BLOQUÉ depuis l'extérieur
# Seul Nginx (localhost) peut y accéder

# Vérifier les règles existantes
Get-NetFirewallRule -DisplayName "*5001*"

# Si le port 5001 est ouvert, le FERMER :
Remove-NetFirewallRule -DisplayName "Allow Port 5001"

# S'assurer que le port 80 est ouvert
New-NetFirewallRule -DisplayName "Allow HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

## 🧪 Tests de validation

### Test 1 : Backend (localhost uniquement)
```powershell
# Depuis la VM - Doit fonctionner
curl http://localhost:5001/api/auth/me

# Depuis un autre PC - Doit échouer (connexion refusée)  
Test-NetConnection -ComputerName 172.20.0.3 -Port 5001
# TcpTestSucceeded doit être False
```

### Test 2 : Frontend via Nginx
```powershell
# Depuis la VM
curl http://172.20.0.3

# Depuis le PC client
Test-NetConnection -ComputerName 172.20.0.3 -Port 80
# TcpTestSucceeded doit être True
```

### Test 3 : API via reverse proxy
```powershell
# Test de l'API via Nginx (pas d'authentification requise pour ce test)
curl http://172.20.0.3/api/auth/me -v
# Devrait retourner 401 (non authentifié) - c'est normal !
# L'important est que la requête passe par Nginx
```

### Test 4 : SignalR
```javascript
// Dans la console du navigateur (après login)
// Vérifier que la connexion SignalR fonctionne
// Network tab > WS > check-updates > Status 101 (Switching Protocols)
```

## ⚠️ Points critiques

### 1. Accès à la VM
**TOUJOURS** accéder à la VM via son IP : `http://172.20.0.3`

**JAMAIS** :
- ❌ `http://localhost` (depuis la VM)
- ❌ `http://localhost:5001` (depuis n'importe où)
- ❌ `http://172.20.0.3:5001` (port bloqué)

### 2. CORS
Le backend accepte **uniquement** les requêtes depuis `http://172.20.0.3` (pas localhost).

Si vous voyez des erreurs CORS, vérifiez :
```powershell
# 1. Origin dans les logs du navigateur  
# Doit être : http://172.20.0.3

# 2. Configuration backend
Get-Content backend\appsettings.json | Select-String -Pattern "AllowedOrigins"

# 3. CORS headers dans Nginx
curl -I http://172.20.0.3/api/auth/me -H "Origin: http://172.20.0.3"
```

### 3. SignalR
SignalR nécessite :
- ✅ WebSocket support (Nginx : `proxy_set_header Upgrade $http_upgrade`)
- ✅ CORS headers sur `/hubs/`
- ✅ JWT dans cookie OU query string (`access_token`)

## 📊 Diagnostics

### Logs Backend
```powershell
# IIS Logs
Get-Content C:\inetpub\logs\LogFiles\W3SVC1\*.log -Tail 50

# Application Logs  
Get-EventLog -LogName Application -Source "IIS*" -Newest 20
```

### Logs Nginx
```powershell
# Error log
Get-Content C:\nginx-1.28.1\logs\error.log -Tail 50

# Access log
Get-Content C:\nginx-1.28.1\logs\access.log -Tail 50
```

### Logs Browser
```javascript
// Console JavaScript
console.log("API Base:", window.APP_CONFIG?.API_BASE_URL)
// Doit afficher : http://172.20.0.3

// Network tab
// Toutes les requêtes doivent être vers http://172.20.0.3
// Aucune requête vers localhost:5001
```

## 🔍 Checklist finale

Avant de tester :
- [ ] Backend écoute sur localhost:5001 uniquement
- [ ] Frontend build contient config.js dans out/
- [ ] Nginx.conf contient les 3 locations (/api/, /hubs/, /uploads/)
- [ ] Port 5001 est bloqué depuis l'extérieur
- [ ] Port 80 est ouvert
- [ ] appsettings.json : AllowedOrigins = ["http://172.20.0.3"]
- [ ] config.js : API_BASE_URL = "http://172.20.0.3"

Après déploiement :
- [ ] Login fonctionne depuis PC client  
- [ ] Dashboard charge les statistiques
- [ ] Création de chèque fonctionne
- [ ] Historique s'affiche
- [ ] Pas d'erreurs CORS dans la console
- [ ] SignalR connecté (Network > WS)
- [ ] Pas de requêtes vers localhost:5001

## 🎯 Avantages de cette architecture

1. **Sécurité** : Backend inaccessible directement depuis le réseau
2. **Simplicité** : Une seule URL pour tout (http://172.20.0.3)
3. **CORS propre** : Nginx gère les headers, pas de wildcard "*"
4. **Maintenabilité** : Configuration centralisée (config.js)
5. **Performance** : Nginx sert les fichiers statiques directement
6. **Évolutivité** : Facilite l'ajout de HTTPS, load balancing, etc.

## 📞 Support

Si problèmes persistent après déploiement, fournir :
1. Sortie de `nginx -t`
2. Logs Nginx (error.log)
3. Console browser (erreurs réseau)
4. Logs backend (IIS ou console)
5. Résultat de `netstat -ano | findstr :5001`
