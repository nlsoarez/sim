(function initializeSimBackend() {
    if (window.__SIM_TEST_BACKEND__) {
        window.SIMBackend = window.__SIM_TEST_BACKEND__;
        return;
    }

    const SUPABASE_URL = 'https://aaxdcpftynjphzitigrv.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qJaICKj1Ro-tO3DPqtr9TA_9cFFccCS';
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const normalizeProfile = (profile, email = '') => profile ? ({
        id: profile.user_id,
        username: profile.user_id,
        email,
        displayName: profile.display_name,
        role: profile.role,
        group: profile.group_id,
        active: profile.active
    }) : null;

    const requireData = (result) => {
        if (result.error) throw result.error;
        return result.data;
    };

    const getProfile = async (authUser) => {
        if (!authUser) return null;
        const profile = requireData(await client.from('sim_profiles').select('*').eq('user_id', authUser.id).maybeSingle());
        if (!profile?.active) return null;
        return normalizeProfile(profile, authUser.email || '');
    };

    const getCurrentUser = async () => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) return null;
        const profile = await getProfile(data.session.user);
        if (!profile) await client.auth.signOut();
        return profile;
    };

    const signIn = async (email, password) => {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw new Error('E-mail ou senha inválidos.');
        const profile = await getProfile(data.user);
        if (!profile) {
            await client.auth.signOut();
            throw new Error('Sua conta não tem acesso ativo ao SIM.');
        }
        return profile;
    };

    const listProfiles = async () => {
        const rows = requireData(await client.from('sim_profiles').select('*').eq('active', true).order('display_name')) || [];
        return rows.map(row => normalizeProfile(row));
    };

    const listMessages = async (profiles = []) => {
        const [messageRows, receiptRows] = await Promise.all([
            client.from('sim_messages').select('*').order('created_at', { ascending: false }),
            client.from('sim_message_receipts').select('*').order('confirmed_at', { ascending: false })
        ]);
        const messages = requireData(messageRows) || [];
        const receipts = requireData(receiptRows) || [];
        const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
        return messages.map(message => ({
            id: message.id,
            senderId: message.sender_id,
            from: profileMap.get(message.sender_id)?.displayName || 'Administrador',
            to: message.target_type === 'all' ? 'todos' : (message.target_type === 'group' ? `group:${message.target_group}` : message.target_user_id),
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
        }));
    };

    const sendMessage = async ({ target, title, text }) => {
        const row = { title: title.trim(), body: text.trim(), target_type: 'all', target_user_id: null, target_group: null };
        if (String(target).startsWith('group:')) {
            row.target_type = 'group';
            row.target_group = String(target).slice(6);
        } else if (target !== 'todos') {
            row.target_type = 'user';
            row.target_user_id = target;
        }
        requireData(await client.from('sim_messages').insert(row));
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
        if (file.type) return file.type;
        const extension = file.name.split('.').pop()?.toLowerCase();
        return ({
            pdf: 'application/pdf', csv: 'text/csv', xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })[extension] || 'application/octet-stream';
    };

    const uploadDocument = async (file) => {
        if (!file || file.size <= 0) throw new Error('Selecione um arquivo válido.');
        if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 20 MB.');
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'csv', 'xls', 'xlsx'].includes(extension)) throw new Error('Envie PDF, CSV, XLS ou XLSX.');
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

    const subscribe = (refresh) => {
        const channel = client.channel('sim-workspace')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_messages' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_message_receipts' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_documents' }, refresh)
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
        getCurrentUser, signIn, signOut: () => client.auth.signOut(), onAuthStateChange,
        listProfiles, listMessages, sendMessage, confirmMessage, deleteMessages,
        listDocuments, uploadDocument, openDocument, createUser, subscribe
    };
})();
