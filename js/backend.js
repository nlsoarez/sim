(function initializeSimBackend() {
    if (window.__SIM_TEST_BACKEND__) {
        window.SIMBackend = window.__SIM_TEST_BACKEND__;
        return;
    }

    const SUPABASE_URL = 'https://tapqwjlsacleadqxelep.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__FxWZaIEkFAZiCkgf4zAUg_aqQwa-KZ';
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const normalizeProfile = (profile, email = '') => profile ? ({
        id: profile.user_id,
        username: profile.user_id,
        email,
        displayName: profile.role === 'admin' ? String(profile.display_name || '').toLocaleUpperCase('pt-BR') : profile.display_name,
        loginId: profile.login_id || '',
        role: profile.role,
        group: profile.group_id,
        active: profile.active,
        mustChangePassword: Boolean(profile.must_change_password)
    }) : null;

    const requireData = (result) => {
        if (result.error) throw result.error;
        return result.data;
    };

    const getProfile = async (authUser) => {
        if (!authUser) return null;
        const profile = requireData(await client.from('sim_profiles').select('*').eq('user_id', authUser.id).maybeSingle());
        return normalizeProfile(profile, authUser.email || '');
    };

    const getCurrentUser = async () => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) return null;
        const profile = await getProfile(data.session.user);
        if (!profile?.active) {
            await client.auth.signOut();
            return null;
        }
        return profile;
    };

    const signIn = async (identifier, password) => {
        const { data: loginData, error: loginError } = await client.functions.invoke('sim-login', {
            body: { identifier: String(identifier || '').trim(), password: String(password || '') }
        });
        if (loginError || !loginData?.accessToken || !loginData?.refreshToken) {
            throw new Error('Matrícula/e-mail ou senha inválidos.');
        }
        const { data, error } = await client.auth.setSession({
            access_token: loginData.accessToken,
            refresh_token: loginData.refreshToken
        });
        if (error || !data.user) throw new Error('Matrícula/e-mail ou senha inválidos.');
        const profile = await getProfile(data.user);
        if (!profile?.active) {
            await client.auth.signOut();
            throw new Error(profile ? 'Seu acesso ao SIM está desativado. Procure um perfil Adm.' : 'Sua conta não tem acesso ao SIM.');
        }
        return profile;
    };

    const changeInitialPassword = async (newPassword) => {
        const password = String(newPassword || '');
        if (password.length < 12) throw new Error('A nova senha deve ter pelo menos 12 caracteres.');

        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error(error.message || 'Não foi possível alterar a senha.');

        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) throw userError || new Error('Sessão inválida após a troca de senha.');
        const profile = await getProfile(userData.user);
        if (!profile || profile.mustChangePassword) {
            throw new Error('A senha foi alterada, mas o acesso ainda não foi liberado. Entre novamente.');
        }
        return profile;
    };

    const listProfiles = async () => {
        const rows = requireData(await client.from('sim_profiles').select('*').eq('active', true).order('display_name')) || [];
        return rows.map(row => normalizeProfile(row));
    };

    const listPendingProfiles = async () => {
        const [profileResult, requestResult] = await Promise.all([
            client.from('sim_profiles').select('*').eq('active', false).order('created_at'),
            client.from('sim_registration_requests').select('user_id,email,requested_at').eq('status', 'pending').order('requested_at')
        ]);
        const rows = requireData(profileResult) || [];
        const requests = requireData(requestResult) || [];
        const requestMap = new Map(requests.map(request => [request.user_id, request]));
        return rows.filter(row => requestMap.has(row.user_id)).map(row => ({
            ...normalizeProfile(row),
            email: requestMap.get(row.user_id)?.email || '',
            requestedAt: requestMap.get(row.user_id)?.requested_at || row.created_at
        }));
    };

    const listMessages = async (profiles = []) => {
        const [messageRows, receiptRows, recipientRows] = await Promise.all([
            client.from('sim_messages').select('*').order('created_at', { ascending: false }),
            client.from('sim_message_receipts').select('*').order('confirmed_at', { ascending: false }),
            client.from('sim_message_recipients').select('message_id,user_id')
        ]);
        const messages = requireData(messageRows) || [];
        const receipts = requireData(receiptRows) || [];
        const recipients = requireData(recipientRows) || [];
        const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
        return messages.map(message => {
            const recipientIds = recipients.filter(recipient => recipient.message_id === message.id).map(recipient => recipient.user_id);
            return {
                id: message.id,
                senderId: message.sender_id,
                from: profileMap.get(message.sender_id)?.displayName || 'Adm',
                to: message.target_type === 'users' ? recipientIds : (message.target_type === 'all' ? 'todos' : (message.target_type === 'group' ? `group:${message.target_group}` : message.target_user_id)),
                recipientIds,
                targetType: message.target_type,
                targetUserId: message.target_user_id,
                targetGroup: message.target_group,
                title: message.title,
                text: message.body,
                date: new Date(message.created_at).toLocaleString('pt-BR'),
                createdAt: message.created_at,
                readBy: receipts.filter(receipt => receipt.message_id === message.id).map(receipt => ({
                    username: receipt.user_id,
                    displayName: profileMap.get(receipt.user_id)?.displayName || 'Usuário',
                    date: new Date(receipt.confirmed_at).toLocaleString('pt-BR')
                }))
            };
        });
    };

    const sendMessage = async ({ recipientIds, title, text }) => {
        const recipients = Array.from(new Set((recipientIds || []).filter(Boolean)));
        if (!recipients.length) throw new Error('Selecione pelo menos um destinatário.');
        const message = requireData(await client.from('sim_messages').insert({
            title: title.trim(), body: text.trim(), target_type: 'users', target_user_id: null, target_group: null
        }).select('id').single());
        const recipientResult = await client.from('sim_message_recipients').insert(recipients.map(userId => ({ message_id: message.id, user_id: userId })));
        if (recipientResult.error) {
            await client.from('sim_messages').delete().eq('id', message.id);
            throw recipientResult.error;
        }
    };

    const sendTeamsMessage = async ({ teamsTargets, title, text }) => {
        const targets = Array.from(new Set((teamsTargets || []).filter(Boolean)));
        for (const target of targets) {
            const { error } = await client.functions.invoke('sim-teams-message', {
                body: { target, title: title.trim(), text: text.trim() }
            });
            if (error) {
                let message = 'Não foi possível enviar a mensagem ao Teams.';
                try {
                    const body = await error.context?.json();
                    if (body?.error) message = body.error;
                } catch (_) { /* response body may already be consumed */ }
                throw new Error(message);
            }
        }
        return { sent: true, deliveries: targets.length };
    };

    const confirmMessage = async (messageId) => {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData.user) throw authError || new Error('Sessão inválida.');
        const { error } = await client.from('sim_message_receipts').insert({ message_id: messageId, user_id: authData.user.id });
        if (error && error.code !== '23505') throw error;
    };

    const deleteMessages = async (ids) => requireData(await client.from('sim_messages').delete().in('id', ids));

    const listDocuments = async () => requireData(await client.from('sim_documents').select('*').eq('active', true).order('created_at', { ascending: false })) || [];

    const detectMimeType = (file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'rar') return 'application/vnd.rar';
        if (file.type) return file.type;
        return ({
            pdf: 'application/pdf', csv: 'text/csv', xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })[extension] || 'application/octet-stream';
    };

    const uploadDocument = async (file) => {
        if (!file || file.size <= 0) throw new Error('Selecione um arquivo válido.');
        if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 20 MB.');
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'csv', 'xls', 'xlsx', 'rar'].includes(extension)) throw new Error('Envie PDF, CSV, XLS, XLSX ou RAR.');
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
        const storagePath = `escalas/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
        const mimeType = detectMimeType(file);
        const upload = await client.storage.from('sim-documents').upload(storagePath, file, { contentType: mimeType, upsert: false });
        if (upload.error) throw upload.error;
        const title = file.name.replace(/\.[^.]+$/, '');
        const metadata = await client.from('sim_documents').insert({
            title, file_name: file.name, storage_path: storagePath, mime_type: mimeType, size_bytes: file.size
        });
        if (metadata.error) {
            await client.storage.from('sim-documents').remove([storagePath]);
            throw metadata.error;
        }
    };

    const openDocument = async (document) => {
        const { data, error } = await client.storage.from('sim-documents').createSignedUrl(document.storage_path, 60);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    };

    const deleteDocument = async (documentId) => {
        const { data, error } = await client.functions.invoke('sim-admin-actions', {
            body: { action: 'delete_document', documentId }
        });
        if (error) {
            let message = 'Não foi possível excluir o documento.';
            try {
                const body = await error.context?.json();
                if (body?.error) message = body.error;
            } catch (_) { /* response body may already be consumed */ }
            throw new Error(message);
        }
        return data;
    };

    const getContactDirectory = async () => {
        const row = requireData(await client
            .from('sim_contact_directory')
            .select('contact_store, source_file_name, updated_at')
            .eq('id', 1)
            .maybeSingle());
        return row ? {
            contactStore: row.contact_store,
            sourceFileName: row.source_file_name,
            updatedAt: row.updated_at
        } : null;
    };

    const saveContactDirectory = async (contactStore, sourceFileName) => {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData.user) throw authError || new Error('Sessão inválida.');
        const safeFileName = String(sourceFileName || '').trim().slice(0, 255);
        if (!safeFileName) throw new Error('Nome do arquivo de origem inválido.');
        const row = requireData(await client.from('sim_contact_directory').upsert({
            id: 1,
            contact_store: contactStore,
            source_file_name: safeFileName,
            updated_by: authData.user.id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).select('contact_store, source_file_name, updated_at').single());
        return {
            contactStore: row.contact_store,
            sourceFileName: row.source_file_name,
            updatedAt: row.updated_at
        };
    };

    const createUser = async (payload) => {
        const { data, error } = await client.functions.invoke('sim-admin-users', { body: payload });
        if (error) {
            let message = 'Não foi possível criar o usuário.';
            try {
                const body = await error.context?.json();
                if (body?.error) message = body.error;
            } catch (_) { /* response body may already be consumed */ }
            throw new Error(message);
        }
        return data.user;
    };

    const approveUser = async ({ userId, groupId }) => {
        const { data, error } = await client.functions.invoke('sim-admin-users', {
            body: { action: 'approve', userId, groupId }
        });
        if (error) {
            let message = 'Não foi possível aprovar o usuário.';
            try {
                const body = await error.context?.json();
                if (body?.error) message = body.error;
            } catch (_) { /* response body may already be consumed */ }
            throw new Error(message);
        }
        return data.user;
    };

    const deleteUser = async (userId) => {
        const { data, error } = await client.functions.invoke('sim-admin-users', {
            body: { action: 'delete', userId }
        });
        if (error) {
            let message = 'Não foi possível excluir o usuário do SIM.';
            try {
                const body = await error.context?.json();
                if (body?.error) message = body.error;
            } catch (_) { /* response body may already be consumed */ }
            throw new Error(message);
        }
        return data.user;
    };

    const subscribe = (refresh) => {
        const channel = client.channel('sim-workspace')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_messages' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_message_recipients' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_message_receipts' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_documents' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_profiles' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_contact_directory' }, refresh)
            .subscribe();
        return () => client.removeChannel(channel);
    };

    const onAuthStateChange = (callback) => {
        const { data } = client.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') callback(null);
        });
        return () => data.subscription.unsubscribe();
    };

    window.SIMBackend = {
        getCurrentUser, signIn, changeInitialPassword, signOut: () => client.auth.signOut(), onAuthStateChange,
        listProfiles, listPendingProfiles, listMessages, sendMessage, sendTeamsMessage, confirmMessage, deleteMessages,
        listDocuments, uploadDocument, openDocument, deleteDocument,
        getContactDirectory, saveContactDirectory,
        createUser, approveUser, deleteUser, subscribe
    };
})();
