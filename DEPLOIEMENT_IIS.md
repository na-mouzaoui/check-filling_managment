# 🚀 Déploiement avec IIS - Guide Complet

## 📐 Architecture

```
Navigateur (PC ou VM)
    ↓
http://172.20.0.3 (Nginx port 80)
    ↓
  /api/      → localhost:5001 (IIS)
  /hubs/     → localhost:5001 (IIS)
  /uploads/  → localhost:5001 (IIS)
  /          → Nginx (fichiers statiques frontend)
```

**Principe clé** : URLs relatives partout (`/api/...`, `/hubs/...`)

---

## 🔧 1. Configuration Backend (IIS)

### Publier le backend

```powershell
# Dans la VM
cd C:\Users\mouza\OneDrive\Desktop\check-filling_managment\backend

# Publier en Release
dotnet publish --configuration Release --output C:\inetpub\wwwroot\CheckFillingAPI
```

### Configurer IIS

1. **Ouvrir IIS Manager** (`inetmgr`)

2. **Créer un Application Pool** :
   - Nom : `CheckFillingAPI`
   - .NET CLR version : `No Managed Code`
   - Start automatically : ✅

3. **Créer le site** :
   - Sites → Add Website
   - Site name : `CheckFillingAPI`
   - Application pool : `CheckFillingAPI`
   - Physical path : `C:\inetpub\wwwroot\CheckFillingAPI`
   - Binding :
     - Type : `http`
     - IP : `127.0.0.1` (localhost uniquement)
     - Port : `5001`
     - Host name : (vide)

4. **Permissions** :
   - Clic droit sur `C:\inetpub\wwwroot\CheckFillingAPI`
   - Properties → Security → Edit
   - Ajouter : `IIS AppPool\CheckFillingAPI`
   - Permissions : Read & Execute, List, Read

### Vérifier web.config

Le fichier `web.config` doit être créé automatiquement lors du `dotnet publish`. Vérifie qu'il contient :

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" 
                  arguments=".\CheckFillingAPI.dll" 
                  stdoutLogEnabled="true" 
                  stdoutLogFile=".\logs\stdout" 
                  hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
```

### Créer le dossier logs

```powershell
New-Item -Path "C:\inetpub\wwwroot\CheckFillingAPI\logs" -ItemType Directory -Force
```

### Redémarrer IIS

```powershell
iisreset
```

### Tester le backend

```powershell
# Devrait retourner 401 (non authentifié)
Invoke-WebRequest -Uri "http://localhost:5001/api/auth/me" -Method GET
```

---

## 🌐 2. Configuration Frontend (Nginx)

### Rebuild le frontend

```powershell
cd C:\Users\mouza\OneDrive\Desktop\check-filling_managment\frontend

# Rebuild
npm run build

# Déployer
Remove-Item -Path C:\nginx\html\* -Recurse -Force
Copy-Item -Path .\out\* -Destination C:\nginx\html\ -Recurse

# IMPORTANT : Vérifier que config.js est présent
Get-Content C:\nginx\html\config.js
```

Doit afficher :
```javascript
window.APP_CONFIG = {
  API_BASE_URL: ""
}
```

### Copier la config Nginx

```powershell
# Sauvegarder l'ancienne
Copy-Item C:\nginx-1.28.1\conf\nginx.conf C:\nginx-1.28.1\conf\nginx.conf.backup

# Copier la nouvelle
Copy-Item C:\Users\mouza\OneDrive\Desktop\check-filling_managment\nginx-final.conf C:\nginx-1.28.1\conf\nginx.conf

# Tester
cd C:\nginx-1.28.1
.\nginx.exe -t

# Recharger
.\nginx.exe -s reload
```

---

## ⚙️ 3. Configuration CORS (Backend uniquement)

Le fichier [backend/Program.cs](backend/Program.cs) doit avoir **exactement** :

```csharp
// CORS - UNE SEULE origine
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://172.20.0.3")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Middleware - ORDRE IMPORTANT
app.UseCors("AllowFrontend");      // 1. CORS en premier
app.UseStaticFiles();              // 2. Fichiers statiques
app.UseRouting();                  // 3. Routing
app.UseAuthentication();           // 4. Auth
app.UseAuthorization();            // 5. Authz
app.MapControllers();
app.MapHub<CheckUpdatesHub>("/hubs/check-updates").RequireCors("AllowFrontend");
```

[backend/appsettings.json](backend/appsettings.json) :

```json
{
  "Cors": {
    "AllowedOrigins": [
      "http://172.20.0.3"
    ]
  }
}
```

**⚠️ Pas de CORS dans Nginx** - tout est géré par ASP.NET Core.

---

## 🔥 4. Pare-feu

```powershell
# Port 80 : OUVERT (Nginx)
New-NetFirewallRule -DisplayName "Allow HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Port 5001 : FERMÉ depuis l'extérieur (seul localhost peut y accéder)
# Supprimer toute règle qui ouvre 5001
Get-NetFirewallRule -DisplayName "*5001*" | Remove-NetFirewallRule -ErrorAction SilentlyContinue
```

---

## 🧪 5. Tests de validation

### Test 1 : Backend accessible en local seulement

```powershell
# ✅ Depuis la VM - Doit fonctionner
Invoke-WebRequest -Uri "http://localhost:5001/api/auth/me"
# Résultat attendu : 401 Unauthorized (c'est normal, pas authentifié)

# ❌ Depuis un autre PC - Doit échouer
Test-NetConnection -ComputerName 172.20.0.3 -Port 5001
# TcpTestSucceeded doit être False
```

### Test 2 : Accès via Nginx

```powershell
# Depuis la VM ou un PC client
Invoke-WebRequest -Uri "http://172.20.0.3/api/auth/me"
# Résultat attendu : 401 Unauthorized (backend accessible via Nginx)
```

### Test 3 : Frontend

Ouvre `http://172.20.0.3` dans le navigateur :
- Page de login s'affiche
- Console JavaScript : `window.APP_CONFIG` → `{API_BASE_URL: ""}`
- Network tab : toutes les requêtes vers `/api/...` (URLs relatives)

### Test 4 : Login

- Login avec des credentials valides
- Console : aucune erreur CORS
- Dashboard se charge avec les statistiques

### Test 5 : SignalR

Dans la console du navigateur après login :
```javascript
// Network tab → WS
// Chercher : /hubs/check-updates
// Status devrait être : 101 Switching Protocols
```

---

## 🐛 Troubleshooting

### Problème : 500 Internal Server Error

```powershell
# Vérifier les logs backend
Get-Content C:\inetpub\wwwroot\CheckFillingAPI\logs\stdout*.log -Tail 50

# Vérifier que l'AppPool tourne
Get-IISAppPool -Name "CheckFillingAPI" | Select-Object Name, State

# Redémarrer l'AppPool
Restart-WebAppPool -Name "CheckFillingAPI"
```

### Problème : Erreur CORS

**Symptôme** : `Access to fetch at '...' from origin 'http://172.20.0.3' has been blocked by CORS policy`

**Solution** :
1. Vérifier [backend/appsettings.json](backend/appsettings.json) → `AllowedOrigins: ["http://172.20.0.3"]`
2. Vérifier [backend/Program.cs](backend/Program.cs#L31-L36) → `WithOrigins("http://172.20.0.3")`
3. Republier le backend : `dotnet publish --configuration Release -o C:\inetpub\wwwroot\CheckFillingAPI`
4. Redémarrer IIS : `iisreset`

### Problème : SQL Server connexion échoue

```powershell
# Vérifier SQL Server
Get-Service | Where-Object { $_.Name -like "*SQL*" }

# Démarrer si arrêté
Start-Service MSSQL$SQLEXPRESS -ErrorAction SilentlyContinue
```

### Problème : SignalR ne connecte pas

1. Vérifier Nginx logs :
```powershell
Get-Content C:\nginx-1.28.1\logs\error.log -Tail 20
```

2. Vérifier [nginx.conf](nginx-final.conf#L30-L44) contient bien :
```nginx
location /hubs/ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

3. Vérifier dans le navigateur (Network tab) :
   - Requête vers `/hubs/check-updates/negotiate`
   - Response headers contiennent `Access-Control-Allow-Origin: http://172.20.0.3`

---

## 📊 Checklist complète

Avant de tester :
- [ ] Backend publié dans `C:\inetpub\wwwroot\CheckFillingAPI`
- [ ] IIS AppPool `CheckFillingAPI` créé et démarré
- [ ] Site IIS écoute sur `localhost:5001` uniquement
- [ ] Permissions `IIS AppPool\CheckFillingAPI` sur le dossier
- [ ] [appsettings.json](backend/appsettings.json) : `AllowedOrigins: ["http://172.20.0.3"]`
- [ ] [Program.cs](backend/Program.cs) : ordre des middlewares correct
- [ ] Frontend build dans `C:\nginx\html\`
- [ ] [config.js](frontend/public/config.js) : `API_BASE_URL: ""`
- [ ] [nginx.conf](nginx-final.conf) copié dans `C:\nginx-1.28.1\conf\`
- [ ] Nginx rechargé
- [ ] Port 80 ouvert, port 5001 fermé

Après déploiement :
- [ ] `http://localhost:5001/api/auth/me` retourne 401
- [ ] `http://172.20.0.3/api/auth/me` retourne 401
- [ ] Login fonctionne
- [ ] Dashboard charge les données
- [ ] Console sans erreurs CORS
- [ ] SignalR connecté (Network → WS)

---

## 🎯 Commandes rapides

### Redéploiement complet

```powershell
# Backend
cd C:\Users\mouza\OneDrive\Desktop\check-filling_managment\backend
dotnet publish --configuration Release -o C:\inetpub\wwwroot\CheckFillingAPI
iisreset

# Frontend
cd C:\Users\mouza\OneDrive\Desktop\check-filling_managment\frontend
npm run build
Remove-Item C:\nginx\html\* -Recurse -Force
Copy-Item .\out\* C:\nginx\html\ -Recurse
cd C:\nginx-1.28.1
.\nginx.exe -s reload

# Test
Invoke-WebRequest http://172.20.0.3/api/auth/me
```

---

## ✅ Avantages de cette configuration

1. **Sécurité maximale** : Backend inaccessible depuis le réseau
2. **URLs relatives** : Pas de hardcoding d'IPs ou ports
3. **CORS propre** : Géré uniquement par ASP.NET Core
4. **Production-ready** : IIS comme serveur d'application robuste
5. **Maintenance facile** : Une seule URL pour tout (`http://172.20.0.3`)
6. **SignalR optimal** : WebSocket upgrade géré correctement
7. **Pas de CORS dans Nginx** : Configuration simplifiée

---

## 📞 Support

Si problème, fournis :
1. Sortie de `Get-IISAppPool -Name "CheckFillingAPI" | Select-Object Name, State`
2. Contenu de `C:\inetpub\wwwroot\CheckFillingAPI\logs\stdout*.log`
3. Console navigateur (erreurs réseau)
4. Résultat de `netstat -ano | findstr :5001`
