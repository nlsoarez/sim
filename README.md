# SIM — Sistema Integrado Madrugada

Portal estático hospedável no GitHub Pages, com autenticação, dados compartilhados e arquivos privados no Supabase.

## O que está implementado

- Login real por e-mail e senha (Supabase Auth).
- Perfis `admin` e `user`, protegidos por Row Level Security (RLS).
- Administração de usuários pelo próprio portal. Apenas administradores podem criar contas.
- Depósito privado para planilhas de escalonamento e PDFs, com limite de 20 MB.
- Central de mensagens persistente, com envio para todos, grupo ou usuário.
- Confirmação de leitura e relatório imprimível/PDF para administradores.
- Atualização em tempo real de mensagens, confirmações e documentos.

## Acesso inicial

As contas já existentes de Nelson e Kelly foram associadas ao SIM como administradores. As senhas continuam gerenciadas pelo Supabase e não ficam no repositório.

Depois de entrar, um administrador pode abrir **Administração → Gerenciar usuários** e criar as demais contas. A senha inicial precisa ter pelo menos 12 caracteres.

## Publicar planilhas

Um administrador abre **Administração → Anexar planilha de escalonamento**. O arquivo é armazenado no bucket privado `sim-documents` e aparece em **Escalas e documentos** para todos os membros ativos.

Formatos aceitos: `.xlsx`, `.xls`, `.csv` e `.pdf`.

## Backend e segurança

- Projeto Supabase: `divisao-equipe-madrugada` (`aaxdcpftynjphzitigrv`).
- Migração: `supabase/migrations/20260811075616_sim_multiuser_backend.sql`.
- Função de criação de usuários: `supabase/functions/sim-admin-users/index.ts`.
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
