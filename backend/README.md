# Backend LLM (Cloudflare Worker)

Proxy serveur vers Moonshot (Kimi K3) pour le compagnon IA d'**Arcade Gacha**.
La clé API reste côté serveur : elle n'est **jamais** envoyée dans le jeu statique.

## Déployer (une seule fois)

```bash
cd backend
npm i -g wrangler        # ou : npx wrangler
wrangler login           # ouvre le navigateur pour te connecter à Cloudflare
wrangler secret put MOONSHOT_API_KEY   # colle la clé (cf. ~/.claude/moonshot_key)
wrangler deploy
```

`wrangler deploy` affiche l'URL du worker, du type :

```
https://arcade-gacha-llm.<ton-sous-domaine>.workers.dev
```

## Brancher au jeu

Dans l'onglet **Compagnon** du jeu, choisis le moteur **API** et colle cette URL
dans le champ « endpoint ». C'est tout — le compagnon parlera via Kimi K3 pour
toi **et pour tes amis**, sans Ollama ni téléchargement.

## Notes

- Modèle par défaut : `kimi-k3` (surchargeable via `[vars] MODEL = "..."`).
- `max_completion_tokens` est utilisé (Kimi K3 n'accepte pas `max_tokens`).
- Pour des réponses plus rapides, tu peux baisser `max_completion_tokens` (actuellement 80).
- Le worker est gratuit dans la limite du plan Cloudflare (100 000 requêtes/jour).
