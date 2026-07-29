# Scripts EC2 — à placer SUR L'INSTANCE EC2, PAS SUR GITHUB (en général on garde)

Ces scripts facilitent la vie quand vous avez mis votre code sur GitHub :

- `deploy.sh`   → **À UTILISER APRÈS CHAQUE `git push`** sur votre PC
                   Il faut le rendre exécutable sur EC2 avec :
                   `chmod +x /var/www/e-market/scripts/deploy.sh`
