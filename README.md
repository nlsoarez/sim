# SIM — Sistema Integrado Madrugada

Portal estático hospedável no GitHub Pages, com autenticação, dados compartilhados e arquivos privados no Supabase.

## O que está implementado

- Login real por e-mail e senha (Supabase Auth).
- Perfis `admin` e `user`, protegidos por Row Level Security (RLS).
- Cadastro público com validação obrigatória por um administrador.
- Administração de usuários pelo próprio portal. Apenas administradores podem aprovar contas ou criar acesso imediato.
- Depósito privado para planilhas de escalonamento e PDFs, com limite de 20 MB.
- Diretório de contatos por cluster persistido e compartilhado entre todos os usuários ativos.
- Central de mensagens persistente, com envio para todos, grupo ou usuário.
- Envio opcional da mesma mensagem ao Microsoft Teams, sem interromper ou substituir o registro interno.
- Confirmação de leitura e relatório imprimível/PDF para administradores.
- Atualização em tempo real de mensagens, confirmações e documentos.

## Acesso inicial

As contas já existentes de Nelson e Kelly foram associadas ao SIM como administradores. As senhas continuam gerenciadas pelo Supabase e não ficam no repositório.

Na tela inicial, a opção **Cadastrar** cria uma solicitação com nome, e-mail e senha. A senha precisa ter pelo menos 12 caracteres. O solicitante continua sem acesso aos arquivos e mensagens até a validação administrativa. Ao aprovar, o administrador também valida o e-mail da conta.

Depois de entrar, um administrador usa o ícone de engrenagem **Gerenciar usuários** e seleciona **Aprovar** na seção **Cadastros aguardando validação**. O administrador também pode criar uma conta com acesso imediato pelo formulário da mesma página.

## Publicar planilhas

Um administrador abre **Escalas e documentos** e usa o ícone de upload. O arquivo é armazenado no bucket privado `sim-documents` e aparece na mesma página para todos os membros ativos.

Formatos aceitos: `.xlsx`, `.xls`, `.csv` e `.pdf`.

## Backend e segurança

- Projeto Supabase: `divisao-equipe-madrugada` (`aaxdcpftynjphzitigrv`).
- Migrações versionadas em `supabase/migrations/`, incluindo o backend multiusuário, cadastro com aprovação e índices relacionados.
- Função de criação de usuários: `supabase/functions/sim-admin-users/index.ts`.
- Função protegida para ações administrativas em documentos: `supabase/functions/sim-admin-actions/index.ts`.
- Função protegida de envio ao Teams: `supabase/functions/sim-teams-message/index.ts`. Os webhooks ficam em segredo de ambiente e nunca são publicados no GitHub Pages.
- A chave presente no JavaScript é uma chave **publicável**, própria para clientes web. Nenhuma chave secreta ou `service_role` é enviada ao navegador.
- O bucket é privado. Download, upload e metadados dependem de sessão válida e políticas RLS.

## Validação executada

- Verificação de sintaxe dos JavaScripts com `node --check`.
- Teste de navegador: admin envia mensagem → usuário recebe → usuário confirma → admin visualiza a confirmação.
- Teste de políticas no banco para o mesmo fluxo, sem deixar dados de teste.
- Teste de publicação de documento: admin publica metadados → usuário encontra o documento, com limpeza ao final.
- Supabase Security e Performance Advisors revisados; índices de chaves estrangeiras do SIM adicionados.

## Desenvolvimento local

O projeto não exige build. Sirva a raiz com um servidor HTTP, por exemplo:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Depois abra `http://127.0.0.1:8765`.
