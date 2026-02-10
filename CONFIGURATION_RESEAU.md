# Configuration de l'URL de l'API après le build

## Méthode 1 : Modifier le fichier config.js

Après avoir buildé le frontend, vous pouvez modifier l'URL de l'API sans rebuild :

1. Allez dans le dossier `out/` (ou `.next/static/` selon le build)
2. Ouvrez le fichier `config.js` 
3. Modifiez l'URL :

```javascript
window.APP_CONFIG = {
  API_BASE_URL: "http://192.168.1.100:5001"  // Remplacez par l'IP de votre VM
}
```

4. Sauvegardez et rafraîchissez le navigateur

## Méthode 2 : Héberger le frontend sur la VM (RECOMMANDÉ)

1. Sur la VM, démarrez le frontend :
   ```bash
   npm run dev
   # ou
   npm run build && npm run start
   ```

2. Accédez depuis les PCs clients :
   ```
   http://[IP_VM]:3000
   ```

Le frontend sur la VM utilisera `localhost:5001` pour communiquer avec le backend.
