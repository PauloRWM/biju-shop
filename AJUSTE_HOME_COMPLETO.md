# ✅ Ajuste da Home - Seções Dinâmicas por Categoria

## O que foi feito:

Ajustei a página inicial para exibir **seções dinâmicas** baseadas nas categorias configuradas no admin do WordPress.

### Antes:
- Home mostrava apenas 4 "bestsellers" fixos
- Não usava as configurações do admin

### Depois:
- Home busca as seções configuradas em **Configurações → Biju Shop → Página Inicial**
- Cada categoria gera uma seção automática com até 8 produtos
- Seções alternam cores de fundo (zebrado)
- Botão "Ver todos" leva para `/shop` filtrado pela categoria

## 🎨 Estrutura da Home Agora:

1. **Banner Carousel** (3 slides)
2. **Trust Badges** (Atacado, Entrega, Pagamento)
3. **Shop by Category** (Cards das categorias)
4. **Seções de Produtos** ← NOVO! Uma para cada categoria configurada
   - Colares (até 8 produtos)
   - Brincos (até 8 produtos)
   - Pulseiras (até 8 produtos)
   - Anéis (até 8 produtos)
   - Conjuntos (até 8 produtos)
5. **Testimonials** (Depoimentos)
6. **Instagram Feed**
7. **Newsletter**

## 📊 Configuração no Admin:

As seções são configuradas em:
**WordPress Admin → Configurações → Biju Shop → Página Inicial**

Lá você pode:
- Adicionar/remover seções
- Reordenar as categorias
- Cada categoria selecionada gera uma seção na home

## 🔧 Como Funciona:

### 1. Backend (PHP)
```
GET /wp-json/biju/v1/homepage
```
Retorna:
```json
{
  "sections": [
    {
      "name": "Colares",
      "slug": "colares",
      "count": 100,
      "image": "url-da-imagem"
    },
    ...
  ]
}
```

### 2. Frontend (React)
- Busca a configuração via `useHomepageConfig()`
- Para cada seção, cria um componente `<CategorySection>`
- Cada `CategorySection` busca produtos da categoria via `useProducts({ category: "colares", per_page: 8 })`
- Renderiza os produtos em grid 2x4 (mobile) ou 4x2 (desktop)

## 🎯 Benefícios:

✅ **Dinâmico** - Admin controla quais categorias aparecem  
✅ **Performático** - Carrega apenas 8 produtos por seção  
✅ **Responsivo** - Grid adaptável mobile/desktop  
✅ **SEO Friendly** - Cada seção tem título e link para categoria completa  
✅ **Fallback** - Se API falhar, usa categorias padrão  

## 🧪 Testando:

1. Acesse: **http://localhost:5173**
2. Role a página e veja as seções de produtos
3. Cada seção deve mostrar produtos da categoria correspondente
4. Clique em "Ver todos" para ir para `/shop` filtrado

### Verificar no Console:
```
🔍 Fetching products from: http://localhost:8080/wp-json/biju/v1/products?category=colares&per_page=8
✅ Products fetched: 8 Total: 100
```

## 📝 Arquivos Modificados:

- `src/pages/Index.tsx` - Adicionado componente `CategorySection` e lógica de seções dinâmicas
- `src/services/products.ts` - Adicionados logs de debug

## 🔄 Próximos Passos (Opcional):

1. **Adicionar loading skeleton** nas seções enquanto carrega
2. **Carousel horizontal** em vez de grid (para mostrar mais produtos)
3. **Lazy loading** das seções (carregar conforme scroll)
4. **Customizar ordem** dos produtos (mais vendidos, novos, etc.)
5. **Adicionar filtros** dentro de cada seção

## 🎨 Personalização:

Para mudar quantos produtos aparecem por seção, edite:
```typescript
// src/pages/Index.tsx - linha ~300
const { data: productsPage } = useProducts({
  category: section.slug || section.name,
  per_page: 8, // ← Mude aqui (4, 8, 12, etc.)
});
```

Para mudar o layout do grid:
```typescript
// src/pages/Index.tsx - linha ~330
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
  {/* ↑ Mude aqui: grid-cols-3, grid-cols-5, etc. */}
```
