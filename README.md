# SIM — Sistema Integrado Madrugada

Portal estático hospedável no GitHub Pages, com autenticação, dados compartilhados e arquivos privados no Supabase.

## O que está implementado

- Login real por matrícula ou e-mail e senha (Supabase Auth).
- Perfis internos `admin` e `user`, protegidos por Row Level Security (RLS), exibidos como **Adm** e **User**.
- Cadastro de usuários exclusivamente por um perfil Adm autenticado.
- Gestão de usuários pelo próprio portal, protegida no backend.
- Depósito privado para planilhas de escalonamento e PDFs, com limite de 20 MB.
- Diretório de contatos por cluster persistido e compartilhado entre todos os usuários ativos.
- Central de mensagens persistente, com seleção múltipla de destinatários e atalho para selecionar o grupo inteiro.
- Envio opcional da mesma mensagem ao Microsoft Teams, sem interromper ou substituir o registro interno.
- Confirmação de leitura e relatório imprimível/PDF para perfis Adm.
- Atualização em tempo real de mensagens, confirmações e documentos.

## Acesso inicial

As contas já existentes de Nelson e Kelly foram associadas ao SIM como perfis Adm. As senhas continuam gerenciadas pelo Supabase e não ficam no repositório.

Depois de entrar, um perfil Adm usa o ícone de engrenagem **Gerenciar usuários** para criar uma conta com acesso imediato. A senha inicial padrão pode ser `claro123` e deve ser alterada no primeiro acesso.

## Publicar planilhas

Um perfil Adm abre **Documentos** e usa o ícone de upload. O arquivo é armazenado no bucket privado `sim-documents` e aparece na mesma página para todos os membros ativos.

Formatos aceitos: `.xlsx`, `.xls`, `.csv`, `.pdf` e `.rar`.

## Backend e segurança

- Projeto Supabase: `divisao-equipe-madrugada` (`aaxdcpftynjphzitigrv`).
- Migrações versionadas em `supabase/migrations/`, incluindo o backend multiusuário, cadastro com aprovação e índices relacionados.
- Função de criação de usuários: `supabase/functions/sim-admin-users/index.ts`.
- Função pública de autenticação por matrícula ou e-mail: `supabase/functions/sim-login/index.ts`; ela apenas resolve a matrícula e delega a validação da senha ao Supabase Auth.
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
