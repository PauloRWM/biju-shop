# 🔍 Instruções para Debug

## Problema Identificado

O arquivo `.env` não existia no diretório do worktree, então o frontend não sabia onde buscar a API!

## ✅ Correções Aplicadas

1. **Criado arquivo `.env`** em `.claude/worktrees/brave-chaum/.env` com:
   ```
   VITE_API_URL=http://localhost:8080/wp-json/biju/v1
   ```

2. **Adicionados logs de debug** para rastrear as chamadas:
   - `src/services/products.ts` - logs nas requisições
   - `src/pages/Index.tsx` - logs no estado dos produtos

3. **Servidor reiniciado** para carregar o novo `.env`

## 🧪 Como Testar

### 1. Abra o navegador
Acesse: **http://localhost:8081**

### 2. Abra o Console do Navegador
- **Chrome/Edge**: F12 ou Ctrl+Shift+I
- **Firefox**: F12 ou Ctrl+Shift+K

### 3. Verifique os logs

Você deve ver logs como:
```
🔍 Fetching products from: http://localhost:8080/wp-json/biju/v1/products?per_page=40
📦 Params: {per_page: 40}
✅ Products fetched: 20 Total: 571
🔄 State changed: {activeCategory: "Todos", isLoading: false, isError: false, ...}
```

### 4. Teste o filtro de categoria

1. Clique em uma categoria (ex: "Colares")
2. Verifique no console se aparece:
   ```
   🔍 Fetching products from: http://localhost:8080/wp-json/biju/v1/products?category=Colares&per_page=40
   📦 Params: {category: "Colares", per_page: 40}
   ```
3. Os produtos devem ser filtrados na tela

### 5. Teste os botões de filtro

1. Role até a seção "Todos os Produtos"
2. Clique nos botões de categoria (Colares, Brincos, etc.)
3. Verifique se os produtos mudam

## ❌ Se ainda não funcionar

### Verifique no Console:

**Se aparecer erro de CORS:**
```
Access to fetch at 'http://localhost:8080/...' from origin 'http://localhost:8081' has been blocked by CORS
```
→ Precisamos adicionar headers CORS no WordPress

**Se aparecer erro 404:**
```
❌ API Error: 404 Not Found
```
→ O plugin pode não estar ativo ou os permalinks precisam ser salvos

**Se aparecer "isError: true":**
→ A API não está respondendo corretamente

### Comandos úteis:

**Testar API diretamente:**
```bash
curl http://localhost:8080/wp-json/biju/v1/products
curl "http://localhost:8080/wp-json/biju/v1/products?category=Colares"
```

**Ver logs do container WordPress:**
```bash
docker logs wp_app -f
```

**Reiniciar o frontend:**
```bash
# No terminal do projeto
cd .claude/worktrees/brave-chaum
npm run dev
```

## 📊 O que esperar

### Comportamento correto:

1. **Página inicial carrega** → Mostra todos os produtos (20 por página)
2. **Clica em "Colares"** → Mostra apenas colares (100 produtos no total)
3. **Clica em "Brincos"** → Mostra apenas brincos (126 produtos no total)
4. **Clica em "Todos"** → Volta a mostrar todos (571 produtos no total)

### Categorias disponíveis no seu WordPress:

- Acessórios de Cabelo (7)
- Anéis (13)
- Antebraço (16)
- Braceletes (83)
- Brincos (126)
- Chokers Aros (94)
- Colar Folheado (52)
- Colares (100)
- Coleção Letras (20)
- Conjunto Pedra Fusion (55)
- Conjuntos (78)
- E mais...

## 🐛 Problemas Conhecidos

### Categorias do frontend vs WordPress

O frontend tem categorias hardcoded:
- Colares ✅ (existe no WP)
- Brincos ✅ (existe no WP)
- Pulseiras ✅ (existe no WP)
- Anéis ✅ (existe no WP)
- Conjuntos ✅ (existe no WP)

Todas as categorias existem no WordPress, então deve funcionar!

## 📝 Próximos Passos

Depois de testar, me informe:
1. O que aparece no console do navegador?
2. Os produtos estão carregando?
3. O filtro está funcionando?
4. Há algum erro?

Com essas informações, posso ajustar o que for necessário!
