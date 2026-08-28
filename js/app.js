const App = () => {
    const [user, setUser] = React.useState(null);
    const [authLoading, setAuthLoading] = React.useState(true);
    const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
    const [backendError, setBackendError] = React.useState('');
    const [profiles, setProfiles] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [documents, setDocuments] = React.useState([]);
    const [uploadStatus, setUploadStatus] = React.useState(null);
    const [contactUploadStatus, setContactUploadStatus] = React.useState(null);
    const [activeCategory, setActiveCategory] = React.useState(bookmarkData[0]?.name || 'SIM');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [navigationStack, setNavigationStack] = React.useState([]);
    const [currentFolder, setCurrentFolder] = React.useState(null);
    const [showMessages, setShowMessages] = React.useState(false);
    const [seenReadIds, setSeenReadIds] = React.useState([]);
    const [contacts, setContactsState] = React.useState(() => {
        try {
            const saved = localStorage.getItem('sim_contacts');
            return saved ? ensureContactStore(JSON.parse(saved)) : makeContactStore();
        } catch (_) { return makeContactStore(); }
    });
    const [activeToolPage, setActiveToolPage] = React.useState('');
    const contactUploadRef = React.useRef(null);
    const scheduleUploadRef = React.useRef(null);
    const legacyContactsRef = React.useRef(contacts);
    const legacyMigrationAttemptedRef = React.useRef(false);

    const setContacts = (newContacts) => {
        const nextContacts = ensureContactStore(newContacts);
        setContactsState(nextContacts);
        try { localStorage.setItem('sim_contacts', JSON.stringify(nextContacts)); }
        catch (_) { /* Supabase remains the authoritative shared store. */ }
    };
    const countContacts = (store) => CONTACT_CLUSTERS.reduce((total, cluster) => total + (ensureContactStore(store).sheets?.[cluster]?.length || 0), 0);

    const refreshWorkspace = React.useCallback(async (currentUser) => {
        if (!currentUser) return;
        setWorkspaceLoading(true);
        setBackendError('');
        try {
            const nextProfiles = await SIMBackend.listProfiles();
            const [nextMessages, nextDocuments, sharedContacts] = await Promise.all([
                SIMBackend.listMessages(nextProfiles),
                SIMBackend.listDocuments(),
                SIMBackend.getContactDirectory()
            ]);
            setProfiles(nextProfiles);
            setMessages(nextMessages);
            setDocuments(nextDocuments);
            if (sharedContacts?.contactStore) {
                setContacts(sharedContacts.contactStore);
            } else if (currentUser.role === 'admin' && !legacyMigrationAttemptedRef.current && countContacts(legacyContactsRef.current) > 0) {
                legacyMigrationAttemptedRef.current = true;
                const migrated = await SIMBackend.saveContactDirectory(legacyContactsRef.current, 'migração do armazenamento local');
                setContacts(migrated.contactStore);
                setContactUploadStatus({ type: 'success', text: 'Contatos antigos migrados para o diretório compartilhado.' });
            } else {
                setContacts(makeContactStore());
            }
        } catch (error) {
            setBackendError(error.message || 'Não foi possível sincronizar os dados do SIM.');
        } finally { setWorkspaceLoading(false); }
    }, []);

    React.useEffect(() => {
        let active = true;
        SIMBackend.getCurrentUser()
            .then(currentUser => { if (active) setUser(currentUser); })
            .catch(error => { if (active) setBackendError(error.message || 'Falha ao validar a sessão.'); })
            .finally(() => { if (active) setAuthLoading(false); });
        const unsubscribe = SIMBackend.onAuthStateChange(nextUser => { if (active && !nextUser) setUser(null); });
        return () => { active = false; unsubscribe(); };
    }, []);

    React.useEffect(() => {
        if (!user || user.mustChangePassword) {
            setProfiles([]); setMessages([]); setDocuments([]);
            return undefined;
        }
        const storageKey = `sim_seen_read_ids:${user.id}`;
        setSeenReadIds(JSON.parse(localStorage.getItem(storageKey) || '[]'));
        refreshWorkspace(user);
        return SIMBackend.subscribe(() => refreshWorkspace(user));
    }, [user, refreshWorkspace]);

    const handleLogin = async (email, password) => {
        const profile = await SIMBackend.signIn(email, password);
        setUser(profile);
        setBackendError('');
    };
    const handleChangeInitialPassword = async (password) => {
        const profile = await SIMBackend.changeInitialPassword(password);
        setUser(profile);
        setBackendError('');
    };
    const handleLogout = async () => {
        await SIMBackend.signOut();
        setUser(null); setCurrentFolder(null); setNavigationStack([]); setSearchTerm(''); setActiveToolPage('');
    };
    const goHome = () => { setActiveToolPage(''); setActiveCategory('SIM'); setCurrentFolder(null); setNavigationStack([]); setSearchTerm(''); };
    const openFolder = (folder) => { setActiveToolPage(''); setNavigationStack(previous => [...previous, currentFolder || bookmarkData.find(category => category.name === activeCategory)]); setCurrentFolder(folder); setSearchTerm(''); };
    const goBack = () => { const previous = navigationStack[navigationStack.length - 1]; setNavigationStack(stack => stack.slice(0, -1)); setCurrentFolder(previous); };
    const selectCategory = (name) => { setActiveToolPage(''); setActiveCategory(name); setCurrentFolder(null); setNavigationStack([]); setSearchTerm(''); };
    const openToolPage = (page) => { setActiveToolPage(page); setCurrentFolder(null); setNavigationStack([]); setSearchTerm(''); };

    const fieldForHeader = (header) => {
        const normalizedHeader = normalizeText(header).trim();
        if (!normalizedHeader) return '';
        return Object.keys(CONTACT_FIELDS).find(field => CONTACT_FIELDS[field].some(alias => {
            const normalizedAlias = normalizeText(alias);
            return normalizedHeader === normalizedAlias || normalizedHeader.includes(normalizedAlias);
        })) || '';
    };
    const findHeaderRow = (matrix) => {
        let best = { index: 0, score: -1 };
        matrix.slice(0, 25).forEach((row, index) => {
            const fields = new Set((row || []).map(fieldForHeader).filter(Boolean));
            const score = fields.size + (fields.has('nome') ? 2 : 0) + (fields.has('telefone') ? 2 : 0);
            if (score > best.score) best = { index, score };
        });
        return best.index;
    };
    const parseCsv = (text) => {
        const matrix = String(text || '').trim().split(/\r?\n/).map(line => line.split(/;|,|\t/).map(value => value.trim().replace(/^"|"$/g, '')));
        const headerIndex = findHeaderRow(matrix);
        const headers = matrix[headerIndex] || [];
        return matrix.slice(headerIndex + 1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
    };
    const worksheetToRows = (sheet) => {
        if (!window.XLSX || !sheet?.['!ref']) return { rows: [], headerNotes: {} };
        const range = window.XLSX.utils.decode_range(sheet['!ref']);
        const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        const headerOffset = findHeaderRow(matrix);
        const headerRowIndex = range.s.r + headerOffset;
        const headers = [];
        const headerNotes = {};
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = sheet[window.XLSX.utils.encode_cell({ r: headerRowIndex, c: col })];
            const header = String(cell?.v || '').trim();
            headers.push(header);
            if (cell?.c?.length) {
                const field = fieldForHeader(header);
                if (field) headerNotes[field] = cell.c.map(comment => comment.t).filter(Boolean).join('\n');
            }
        }
        const rows = [];
        for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex++) {
            const row = {}; const notes = []; const fieldNotes = {};
            headers.forEach((header, offset) => {
                if (!header) return;
                const cell = sheet[window.XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + offset })];
                row[header] = cell?.v ?? '';
                if (cell?.c?.length) {
                    const note = cell.c.map(comment => comment.t).filter(Boolean).join('\n');
                    const field = fieldForHeader(header);
                    if (field) fieldNotes[field] = note;
                    notes.push(note);
                }
            });
            row.__note = notes.filter(Boolean).join('\n'); row.__fieldNotes = fieldNotes;
            if (Object.values(row).some(value => String(value || '').trim())) rows.push(row);
        }
        return { rows, headerNotes };
    };
    const resolveCluster = (value) => {
        const normalized = normalizeText(value).toUpperCase();
        return CONTACT_CLUSTERS.find(cluster => new RegExp(`(^|[^A-Z])${cluster}([^A-Z]|$)`).test(normalized)) || '';
    };
    const parseContactWorkbook = (workbook) => {
        const sheets = {}; const references = {}; const sheetNotes = {};
        CONTACT_CLUSTERS.forEach(cluster => { sheets[cluster] = []; references[cluster] = []; sheetNotes[cluster] = ''; });
        workbook.SheetNames.forEach((sheetName, index) => {
            const parsed = worksheetToRows(workbook.Sheets[sheetName]);
            const sheetCluster = resolveCluster(sheetName);
            const positionalCluster = CONTACT_CLUSTERS[index % CONTACT_CLUSTERS.length];
            parsed.rows.forEach(row => {
                const cluster = resolveCluster(getRowValue(row, 'cluster')) || sheetCluster || positionalCluster;
                const contact = normalizeContactRow(row, cluster);
                if (contact.nome && contact.phoneDigits) {
                    if (!contact.area) contact.area = cluster;
                    sheets[cluster].push({ ...contact, sheet: cluster });
                    return;
                }
                const reference = normalizeReferenceRow(row, cluster);
                if (reference.area && reference.cidade) references[cluster].push({ ...reference, sheet: cluster });
            });
            const noteCluster = sheetCluster || positionalCluster;
            const firstNote = sheets[noteCluster].find(contact => contact.observacoes || contact.note);
            if (!sheetNotes[noteCluster]) sheetNotes[noteCluster] = parsed.headerNotes?.observacoes || firstNote?.note || firstNote?.observacoes || '';
        });
        return makeContactStore(sheets, references, sheetNotes);
    };
    const handleContactUpload = (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        setContactUploadStatus({ type: 'success', text: 'Importando e publicando contatos...' });
        openToolPage('contacts');
        const reader = new FileReader();
        reader.onload = async loadEvent => {
            try {
                const data = loadEvent.target.result;
                let nextContacts;
                if (window.XLSX && /\.(xlsx|xls)$/i.test(file.name)) {
                    const workbook = window.XLSX.read(data, { type: 'array', cellComments: true });
                    nextContacts = parseContactWorkbook(workbook);
                } else {
                    const rows = parseCsv(new TextDecoder('utf-8').decode(data));
                    const sheets = {};
                    rows.forEach(row => {
                        const cluster = resolveCluster(getRowValue(row, 'cluster')) || 'BA';
                        const contact = normalizeContactRow(row, cluster);
                        if (contact.nome && contact.phoneDigits) {
                            if (!contact.area) contact.area = cluster;
                            sheets[cluster] = sheets[cluster] || [];
                            sheets[cluster].push(contact);
                        }
                    });
                    nextContacts = makeContactStore(sheets, {});
                }
                const importedCount = countContacts(nextContacts);
                if (!importedCount) throw new Error('Nenhum contato válido foi encontrado. Verifique os cabeçalhos Nome e Telefone.');
                const saved = await SIMBackend.saveContactDirectory(nextContacts, file.name);
                setContacts(saved.contactStore);
                setContactUploadStatus(null);
            } catch (error) {
                setContactUploadStatus({ type: 'error', text: error.message || 'Não foi possível importar a planilha de contatos.' });
            } finally { event.target.value = ''; }
        };
        reader.onerror = () => {
            setContactUploadStatus({ type: 'error', text: 'Não foi possível ler o arquivo selecionado.' });
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };
    const handleScheduleUpload = async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        setUploadStatus({ type: 'success', text: 'Enviando arquivo...' }); openToolPage('documents');
        try {
            await SIMBackend.uploadDocument(file);
            await refreshWorkspace(user);
            setUploadStatus(null);
        } catch (error) { setUploadStatus({ type: 'error', text: error.message || 'Falha no envio.' }); }
        finally { event.target.value = ''; }
    };

    const handleSendMessage = async (payload) => {
        await SIMBackend.sendMessage(payload);
        try {
            if (payload.sendToTeams) await SIMBackend.sendTeamsMessage(payload);
        } catch (teamsError) {
            await refreshWorkspace(user);
            const error = new Error(`Mensagem salva no SIM, mas o Teams falhou: ${teamsError.message}`);
            error.internalSaved = true;
            throw error;
        }
        await refreshWorkspace(user);
        return { teamsSent: Boolean(payload.sendToTeams) };
    };
    const handleConfirmMessage = async (messageId) => { await SIMBackend.confirmMessage(messageId); await refreshWorkspace(user); };
    const handleDeleteMessages = async (ids) => { if (!ids.length) return; await SIMBackend.deleteMessages(ids); await refreshWorkspace(user); };
    const handleCreateUser = async (payload) => { await SIMBackend.createUser(payload); await refreshWorkspace(user); };
    const handleDeleteUser = async (userId) => { await SIMBackend.deleteUser(userId); await refreshWorkspace(user); };
    const handleDeleteDocument = async (documentId) => { await SIMBackend.deleteDocument(documentId); await refreshWorkspace(user); };

    if (authLoading) return React.createElement(LoadingPage, null);
    if (!user) return React.createElement(LoginPage, { onLogin: handleLogin });
    if (user.mustChangePassword) return React.createElement(InitialPasswordChangePage, { user, onChangePassword: handleChangeInitialPassword, onLogout: handleLogout });

    const receiptIds = messages.flatMap(message => message.readBy.map(receipt => `${message.id}-${receipt.username}-${receipt.date}`));
    const notificationCount = user.role === 'admin'
        ? receiptIds.filter(id => !seenReadIds.includes(id)).length
        : messages.filter(message => !message.readBy.some(receipt => receipt.username === user.id)).length;
    const openMessageCenter = () => {
        setShowMessages(true);
        if (user.role === 'admin') {
            const next = Array.from(new Set([...seenReadIds, ...receiptIds]));
            setSeenReadIds(next); localStorage.setItem(`sim_seen_read_ids:${user.id}`, JSON.stringify(next));
        }
    };
    const currentCategory = bookmarkData.find(category => category.name === activeCategory);
    const displayContent = () => {
        if (activeToolPage === 'contacts') return React.createElement(ContactsPage, { user, contactStore: contacts, uploadStatus: contactUploadStatus, onRequestUpload: () => contactUploadRef.current?.click(), onBack: goHome });
        if (activeToolPage === 'documents') return React.createElement(DocumentsPage, { user, documents, uploadStatus, onRequestUpload: () => scheduleUploadRef.current?.click(), onOpen: SIMBackend.openDocument, onDelete: handleDeleteDocument, onBack: goHome });
        if (activeToolPage === 'users' && user.role === 'admin') return React.createElement(UserAdminPage, { currentUser: user, profiles, onCreate: handleCreateUser, onDelete: handleDeleteUser, onBack: goHome });
        if (searchTerm) return React.createElement(SearchResults, { searchTerm });
        if (currentFolder) return React.createElement(FolderView, { folder: currentFolder, onOpenFolder: openFolder, onBack: goBack });
        if (!currentCategory) return React.createElement('div', null, 'Categoria não encontrada');
        return React.createElement('div', { className: 'tray-inner category-layout' }, [
            React.createElement(CategoryTabs, { key: 'tabs', categories: bookmarkData, activeCategory, onSelect: selectCategory }),
            React.createElement('div', { key: 'grid', className: 'grid-apps category-grid' }, currentCategory.children.map((item, index) => React.createElement(AppCard, { key: `${item.name}-${index}`, item, onFolderOpen: openFolder })))
        ]);
    };

    const lineIcon = (paths) => React.createElement('svg', { className: 'top-line-icon', width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, paths);
    return React.createElement('div', { className: 'min-h-screen', style: { background: '#d1d5db' } }, [
        user.role === 'admin' && React.createElement('input', { key: 'contact-upload', ref: contactUploadRef, type: 'file', className: 'hidden-file-input', accept: '.xlsx,.xls,.csv,.txt', onChange: handleContactUpload }),
        user.role === 'admin' && React.createElement('input', { key: 'schedule-upload', ref: scheduleUploadRef, type: 'file', className: 'hidden-file-input', accept: '.xlsx,.xls,.csv,.pdf', onChange: handleScheduleUpload }),
        React.createElement('header', { key: 'header', className: 'sticky top-0 z-10 py-1' }, React.createElement('div', { className: 'top-shell' }, React.createElement('div', { className: 'flex flex-col md:flex-row md:items-center md:justify-between gap-4' }, [
            React.createElement('button', { key: 'brand', type: 'button', onClick: goHome, className: 'brand-home-btn flex items-center gap-3' }, [
                React.createElement('div', { key: 'logo-wrap', className: 'w-12 h-12 flex items-center justify-center' }, React.createElement('img', { className: 'portal-logo', src: 'assets/icons/icons8-owl-100.png', alt: 'SIM' })),
                React.createElement('div', { key: 'copy', className: 'brand-copy' }, [
                    React.createElement('h1', { key: 'title', className: 'text-2xl font-bold text-red-700' }, 'SIM'),
                    React.createElement('p', { key: 'subtitle', className: 'text-xs font-semibold text-gray-600' }, 'Sistema Integrado Madrugada'),
                    React.createElement('p', { key: 'welcome', className: 'text-xs text-gray-500' }, `Olá, ${user.role === 'admin' ? user.displayName.toLocaleUpperCase('pt-BR') : user.displayName}`)
                ])
            ]),
            React.createElement('div', { key: 'actions', className: 'flex items-center gap-3 flex-1 md:max-w-xl' }, [
                React.createElement('div', { key: 'search', className: 'relative flex-1' }, [
                    React.createElement('input', { key: 'input', type: 'text', className: 'search-input', placeholder: 'Buscar ferramentas...', value: searchTerm, onChange: event => setSearchTerm(event.target.value) }),
                    searchTerm && React.createElement('button', { key: 'clear', type: 'button', className: 'search-button', onClick: () => setSearchTerm('') }, React.createElement(ClearSearchIcon))
                ]),
                React.createElement('button', { key: 'contacts', type: 'button', onClick: () => openToolPage('contacts'), className: 'header-btn header-icon-btn', title: 'Contatos', 'aria-label': 'Contatos' }, React.createElement(PhoneIcon, { size: 22, className: 'top-line-icon' })),
                React.createElement('button', { key: 'documents', type: 'button', onClick: () => openToolPage('documents'), className: 'header-btn header-icon-btn', title: 'Documentos', 'aria-label': 'Documentos' }, lineIcon([React.createElement('path', { key: 'file', d: 'M6 3h8l4 4v14H6z' }), React.createElement('path', { key: 'fold', d: 'M14 3v5h5' }), React.createElement('path', { key: 'line', d: 'M9 13h6M9 17h6' })])),
                user.role === 'admin' && React.createElement('button', { key: 'admin', type: 'button', onClick: () => openToolPage('users'), className: 'header-btn header-icon-btn', title: 'Gerenciar usuários', 'aria-label': 'Gerenciar usuários' }, React.createElement(ActionIcon, { name: 'Settings', size: 22, className: 'top-line-icon' })),
                React.createElement('button', { key: 'messages', type: 'button', onClick: openMessageCenter, className: 'header-btn header-icon-btn', title: 'Mensagens', 'aria-label': 'Mensagens' }, [
                    React.createElement('img', { key: 'icon', className: 'top-image-icon', src: 'assets/icons/message-envelope.svg', alt: '' }),
                    notificationCount > 0 && React.createElement('span', { key: 'badge', className: 'notification-badge', 'aria-label': `${notificationCount} pendência(s)` })
                ]),
                React.createElement('button', { key: 'logout', type: 'button', onClick: handleLogout, className: 'header-btn header-icon-btn', title: 'Sair', 'aria-label': 'Sair' }, lineIcon([React.createElement('path', { key: 'one', d: 'M7 7l10 10' }), React.createElement('path', { key: 'two', d: 'M17 7L7 17' })]))
            ])
        ]))),
        React.createElement('main', { key: 'main', className: 'main-shell' }, [
            backendError && React.createElement('p', { key: 'error', className: 'system-alert error mb-3' }, backendError),
            workspaceLoading && React.createElement('p', { key: 'loading', className: 'sync-status' }, 'Sincronizando...'),
            React.createElement('section', { key: 'tray', className: 'content-tray fade-in' }, displayContent()),
            React.createElement('p', { key: 'signature', className: 'signature' }, 'Desenvolvido por Kelly Lira e Nelson Leandro')
        ]),
        showMessages && React.createElement(MessageCenter, { key: 'messages-modal', user, profiles, messages, onSend: handleSendMessage, onConfirm: handleConfirmMessage, onDelete: handleDeleteMessages, onClose: () => setShowMessages(false) })
    ]);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
