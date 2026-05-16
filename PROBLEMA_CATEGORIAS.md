# Problema: Produtos não carregam por categoria

## 🔍 Diagnóstico

Identifiquei dois problemas principais que impedem o carregamento correto dos produtos por categoria:

### 1. **Servidor WordPress não está rodando** ⚠️
- A aplicação está configurada para usar a API em `http://localhost:8080/wp-json/biju/v1`
- O servidor não está respondendo neste endereço
- Quando a API falha, o sistema usa dados estáticos de fallback

### 2. **Bug no filtro de categoria do backend PHP** 🐛
- O código PHP estava tentando usar categorias inválidas quando não encontrava o termo
- Isso causava queries vazias no WooCommerce

## ✅ Correções Aplicadas

### Correção no Backend PHP

Atualizei os arquivos:
- `wordpress-plugin/biju-shop-connector/includes/class-products.php`
- `.claude/worktrees/brave-chaum/wordpress-plugin/biju-shop-connector/includes/class-products.php`

**Antes:**
```php
$category = $request->get_param( 'category' );
if ( $category ) {
    $cat_val = sanitize_text_field( $category );
    $term = get_term_by( 'slug', $cat_val, 'product_cat' );
    if ( ! $term instanceof WP_Term ) {
        $term = get_term_by( 'name', $cat_val, 'product_cat' );
    }
    // ❌ Problema: usava $cat_val mesmo se não encontrasse o termo
    $args['category'] = [ $term instanceof WP_Term ? $term->slug : $cat_val ];
}
```

**Depois:**
```php
$category = $request->get_param( 'category' );
if ( $category ) {
    $cat_val = sanitize_text_field( $category );
    // Primeiro tenta por slug
    $term = get_term_by( 'slug', $cat_val, 'product_cat' );
    // Se não encontrar, tenta por nome
    if ( ! $term instanceof WP_Term ) {
        $term = get_term_by( 'name', $cat_val, 'product_cat' );
    }
    // ✅ Só adiciona o filtro se encontrou a categoria
    if ( $term instanceof WP_Term ) {
        $args['category'] = [ $term->slug ];
    }
}
```

## 🚀 Próximos Passos

### 1. Iniciar o servidor WordPress

Você precisa iniciar o ambiente WordPress. Dependendo da sua configuração:

**Se usar Docker:**
```bash
docker-compose up -d
```

**Se usar XAMPP/WAMP/Local:**
- Inicie o servidor Apache e MySQL
- Verifique se o WordPress está acessível em `http://localhost:8080`

**Se usar WP-CLI:**
```bash
wp server --host=localhost --port=8080
```

### 2. Verificar se a API está funcionando

Após iniciar o servidor, teste a API:

```bash
# Testar endpoint de produtos
curl http://localhost:8080/wp-json/biju/v1/products

# Testar endpoint de categorias
curl http://localhost:8080/wp-json/biju/v1/categories

# Testar filtro por categoria
curl "http://localhost:8080/wp-json/biju/v1/products?category=Colares"
```

### 3. Recarregar o plugin WordPress

Se o servidor já estava rodando, você precisa recarregar o plugin para aplicar as correções:

1. Acesse o painel do WordPress: `http://localhost:8080/wp-admin`
2. Vá em **Plugins**
3. Desative e reative o plugin **Biju Shop Connector**

Ou via WP-CLI:
```bash
wp plugin deactivate biju-shop-connector
wp plugin activate biju-shop-connector
```

### 4. Verificar categorias no WooCommerce

Certifique-se de que as categorias existem no WooCommerce com os nomes corretos:
- Colares
- Brincos
- Pulseiras
- Anéis
- Conjuntos

## 🧪 Como Testar

1. Inicie o servidor WordPress
2. Acesse a aplicação: `http://localhost:5173` (ou a porta do Vite)
3. Clique em uma categoria na seção "Compre por Categoria"
4. Verifique se os produtos são filtrados corretamente
5. Teste também usando os botões de filtro acima da lista de produtos

## 📝 Notas Técnicas

### Fluxo de Dados

1. **Frontend (React)** → Envia requisição com `category` (nome da categoria)
2. **Backend (PHP)** → Busca o termo no WordPress por slug ou nome
3. **WooCommerce** → Filtra produtos usando o slug da categoria
4. **Frontend** → Recebe e exibe os produtos filtrados

### Fallback para Dados Estáticos

Se a API falhar, o sistema usa os dados em `src/data/products.ts`. O filtro funciona corretamente neste modo, mas você verá apenas os 8 produtos de exemplo.

## ❓ Problemas Comuns

### "Nenhum produto encontrado"
- Verifique se há produtos cadastrados no WooCommerce
- Confirme que os produtos têm a categoria atribuída
- Verifique se os produtos estão publicados (não em rascunho)

### API retorna erro 404
- Confirme que o plugin está ativado
- Verifique os permalinks: Configurações → Links Permanentes → Salvar
- Teste o endpoint base: `http://localhost:8080/wp-json/`

### Categorias não aparecem
- Verifique se as categorias têm produtos associados
- O endpoint `/categories` só retorna categorias com `hide_empty: true`
