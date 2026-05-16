# 📱 Newsletter WhatsApp - Setup Completo

## ✅ O que foi implementado:

### Backend (PHP):
1. **Classe `Biju_Newsletter`** - Gerencia cadastros de WhatsApp
2. **Endpoint REST** - `POST /biju/v1/newsletter`
3. **Tabela no banco** - `wp_biju_newsletter`
4. **Página de admin** - Visualizar e exportar inscritos

### Frontend (React):
1. **Componente `NewsletterForm`** - Formulário com máscara de WhatsApp
2. **Validação** - Formato brasileiro (99) 99999-9999
3. **Toast notifications** - Feedback visual
4. **Integração com API** - Salva no WordPress

## 🔧 Passos para Ativar:

### 1. Criar a tabela no banco de dados

Acesse o phpMyAdmin ou execute no MySQL:

```sql
CREATE TABLE IF NOT EXISTS wp_biju_newsletter (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    whatsapp varchar(20) NOT NULL,
    created_at datetime NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'active',
    PRIMARY KEY (id),
    UNIQUE KEY whatsapp (whatsapp),
    KEY status (status),
    KEY created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Ou via WordPress Admin:**
1. Acesse: http://localhost:8080/wp-admin
2. Vá em: **Plugins**
3. **Desative** o plugin "Biju Shop Connector"
4. **Ative** novamente (isso executa o hook de ativação que cria a tabela)

### 2. Verificar se o endpoint está funcionando

Teste no terminal:

```bash
curl -X POST http://localhost:8080/wp-json/biju/v1/newsletter \
  -H "Content-Type: application/json" \
  -d '{"whatsapp":"11999999999"}'
```

Resposta esperada:
```json
{
  "success": true,
  "message": "WhatsApp cadastrado com sucesso! Você receberá nossas novidades."
}
```

### 3. Acessar a página de admin

1. Acesse: http://localhost:8080/wp-admin
2. Vá em: **Configurações → Biju Shop — Newsletter**
3. Você verá a lista de inscritos e poderá exportar CSV

## 🎨 Como Funciona no Frontend:

### Formulário na Home:
- Campo com máscara automática: `(99) 99999-9999`
- Validação de formato brasileiro
- Botão com loading state
- Toast de sucesso/erro

### Fluxo:
1. Usuário digita o WhatsApp
2. Máscara formata automaticamente
3. Ao enviar, remove formatação e envia apenas números
4. Backend valida e salva no banco
5. Retorna mensagem de sucesso
6. Toast aparece confirmando

## 📊 Página de Admin:

### Recursos:
- **Lista de inscritos** - Mostra todos os WhatsApp cadastrados
- **Link direto** - Ícone do WhatsApp para abrir conversa
- **Exportar CSV** - Baixa todos os dados
- **Estatísticas** - Total e ativos

### Colunas:
- ID
- WhatsApp (com link para abrir no WhatsApp Web)
- Data de Cadastro
- Status (Ativo/Inativo)

## 🧪 Testando:

### 1. Teste no Frontend:
1. Acesse: http://localhost:5173
2. Role até o final da página (seção Newsletter)
3. Digite um WhatsApp: `11999999999`
4. Clique em "Cadastrar"
5. Deve aparecer um toast verde de sucesso

### 2. Verifique no Admin:
1. Acesse: http://localhost:8080/wp-admin
2. Vá em: **Configurações → Biju Shop — Newsletter**
3. O WhatsApp deve aparecer na lista

### 3. Teste duplicado:
1. Tente cadastrar o mesmo WhatsApp novamente
2. Deve aparecer erro: "Este WhatsApp já está cadastrado"

## 📝 Estrutura do Banco:

```
wp_biju_newsletter
├── id (bigint) - Auto increment
├── whatsapp (varchar 20) - Único
├── created_at (datetime) - Data de cadastro
└── status (varchar 20) - active/inactive
```

## 🔒 Segurança:

- ✅ Sanitização de entrada
- ✅ Validação de formato
- ✅ Unique constraint no banco
- ✅ Proteção contra SQL injection
- ✅ Nonce no admin

## 📤 Exportação CSV:

O CSV exportado contém:
- ID
- WhatsApp
- Data de Cadastro (formato BR: dd/mm/yyyy HH:mm)
- Status

Formato: `newsletter-whatsapp-2026-04-10.csv`

## 🎯 Próximos Passos (Opcional):

1. **Integração com WhatsApp Business API** - Enviar mensagens automáticas
2. **Segmentação** - Adicionar tags/categorias
3. **Campanhas** - Agendar envios
4. **Opt-out** - Link para descadastrar
5. **Double opt-in** - Confirmar cadastro via WhatsApp
6. **Analytics** - Rastrear conversões

## 🐛 Troubleshooting:

### Erro: "Tabela não existe"
→ Execute o SQL de criação da tabela manualmente

### Erro: "WhatsApp inválido"
→ Certifique-se de digitar pelo menos 10 dígitos (DDD + número)

### Erro 500 no endpoint
→ Verifique os logs do WordPress: `docker logs wp_app`

### Formulário não aparece
→ Verifique se o componente `NewsletterForm` foi importado corretamente

## 📞 Formato de WhatsApp:

**Aceito:**
- `11999999999` (11 dígitos)
- `1199999999` (10 dígitos - fixo)
- `+5511999999999` (com código do país)

**Formatação automática:**
- Input: `11999999999`
- Display: `(11) 99999-9999`
- Salvo no banco: `11999999999` (apenas números)

## 🎨 Customização:

### Mudar texto do formulário:
Edite `src/pages/Index.tsx` na seção Newsletter

### Mudar validação:
Edite `src/components/NewsletterForm.tsx` na função `handleSubmit`

### Mudar campos da tabela:
Edite `wordpress-plugin/biju-shop-connector/includes/class-newsletter.php`

---

**Tudo pronto!** 🚀 Agora você pode capturar WhatsApp dos clientes e gerenciar pelo admin do WordPress.
