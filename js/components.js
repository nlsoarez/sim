const AppCard = ({ item, onFolderOpen }) => {
    const isFolder = item.type === 'folder';
    const handleClick = () => {
        if (isFolder && onFolderOpen) onFolderOpen(item);
        else if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
    };
    return React.createElement('button', { type: 'button', className: `${isFolder ? 'folder-card' : 'app-card'} fade-in`, onClick: handleClick }, [
        React.createElement('div', { key: 'icon', className: 'icon-wrapper' }, React.createElement(EmojiComponent, { item })),
        React.createElement('div', { key: 'name', className: 'app-name' }, item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name)
    ]);
};

const LoginPage = ({ onLogin }) => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setError('Preencha todos os campos obrigatórios.');
            return;
        }
        setLoading(true);
        setError('');
        try { await onLogin(email, password); }
        catch (submitError) { setError(submitError.message || 'Não foi possível entrar.'); }
        finally { setLoading(false); }
    };
    return React.createElement('div', { className: 'min-h-screen flex items-center justify-center p-5', style: { background: '#d1d5db' } },
        React.createElement('form', { onSubmit: handleSubmit, className: 'login-card p-8 w-full max-w-sm' }, [
            React.createElement('div', { key: 'logo', className: 'mx-auto w-16 h-16 flex items-center justify-center mb-4' }, React.createElement('img', { className: 'login-logo', src: 'assets/icons/icons8-owl-100.png', alt: 'SIM' })),
            React.createElement('h1', { key: 'title', className: 'text-2xl font-bold text-center text-red-700 mb-1' }, 'SIM'),
            React.createElement('p', { key: 'sub', className: 'text-center text-sm text-gray-500 mb-4' }, 'Sistema Integrado Madrugada'),
            React.createElement('input', { key: 'email', type: 'text', autoComplete: 'username', autoCapitalize: 'none', spellCheck: false, className: 'search-input mb-3', placeholder: 'Matrícula ou e-mail', value: email, onChange: (e) => setEmail(e.target.value) }),
            React.createElement('input', { key: 'pass', type: 'password', autoComplete: 'current-password', className: 'search-input mb-3', placeholder: 'Senha', value: password, onChange: (e) => setPassword(e.target.value) }),
            error && React.createElement('p', { key: 'error', className: 'text-sm text-red-600 mb-3 text-center' }, error),
            React.createElement('button', { key: 'btn', type: 'submit', disabled: loading, className: 'w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-2xl py-3 transition-all' }, loading ? 'Entrando...' : 'Entrar')
        ])
    );
};

const InitialPasswordChangePage = ({ user, onChangePassword, onLogout }) => {
    const [password, setPassword] = React.useState('');
    const [confirmation, setConfirmation] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (password.length < 12) {
            setError('A nova senha deve ter pelo menos 12 caracteres.');
            return;
        }
        if (password !== confirmation) {
            setError('As senhas não coincidem.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onChangePassword(password);
        } catch (changeError) {
            setError(changeError.message || 'Não foi possível alterar a senha.');
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', { className: 'min-h-screen flex items-center justify-center p-5', style: { background: '#d1d5db' } },
        React.createElement('form', { onSubmit: handleSubmit, className: 'login-card password-change-card p-8 w-full max-w-sm' }, [
            React.createElement('div', { key: 'logo', className: 'mx-auto w-16 h-16 flex items-center justify-center mb-4' }, React.createElement('img', { className: 'login-logo', src: 'assets/icons/icons8-owl-100.png', alt: 'SIM' })),
            React.createElement('h1', { key: 'title', className: 'text-xl font-bold text-center text-red-700 mb-2' }, 'Altere sua senha'),
            React.createElement('p', { key: 'welcome', className: 'password-change-copy' }, `Olá, ${user.displayName}. Por segurança, defina uma senha pessoal antes de acessar o SIM.`),
            React.createElement('input', { key: 'password', type: 'password', minLength: 12, required: true, autoComplete: 'new-password', className: 'search-input mb-3', placeholder: 'Nova senha (mínimo 12 caracteres)', value: password, onChange: event => setPassword(event.target.value) }),
            React.createElement('input', { key: 'confirmation', type: 'password', minLength: 12, required: true, autoComplete: 'new-password', className: 'search-input mb-3', placeholder: 'Confirme a nova senha', value: confirmation, onChange: event => setConfirmation(event.target.value) }),
            error && React.createElement('p', { key: 'error', className: 'text-sm text-red-600 mb-3 text-center' }, error),
            React.createElement('button', { key: 'submit', type: 'submit', disabled: loading, className: 'w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-2xl py-3 transition-all' }, loading ? 'Alterando...' : 'Alterar senha e entrar'),
            React.createElement('button', { key: 'logout', type: 'button', disabled: loading, onClick: onLogout, className: 'password-change-logout' }, 'Sair')
        ])
    );
};

const LoadingPage = ({ message = 'Carregando o SIM...' }) => React.createElement('div', {
    className: 'min-h-screen flex items-center justify-center p-5', style: { background: '#d1d5db' }
}, React.createElement('div', { className: 'login-card p-8 text-center text-gray-600' }, message));

const CategoryTabs = ({ categories, activeCategory, onSelect }) => {
    return React.createElement('div', { className: 'category-tabs scrollbar-hide' },
        categories.map(cat => React.createElement('button', { key: cat.name, onClick: () => onSelect(cat.name), className: `tab-button ${activeCategory === cat.name ? 'active' : ''}` }, cat.name))
    );
};

const SearchResults = ({ searchTerm }) => {
    const normalizedSearch = normalizeText(searchTerm);
    const results = React.useMemo(() => {
        if (!normalizedSearch) return [];
        return searchIndex.filter(item => normalizeText(item.name).includes(normalizedSearch) || item.searchable.includes(normalizedSearch));
    }, [normalizedSearch]);
    if (results.length === 0) {
        return React.createElement('div', { className: 'text-center py-20' }, [
            React.createElement(IconComponent, { key: 'icon', name: 'Search', size: 48, className: 'mx-auto text-gray-400 mb-4' }),
            React.createElement('p', { key: 'text', className: 'text-gray-500' }, `Nenhum resultado encontrado para "${searchTerm}"`)
        ]);
    }
    return React.createElement('div', { className: 'tray-inner' },
        React.createElement('div', { className: 'grid-apps fade-in' }, results.map((result, idx) => React.createElement(AppCard, { key: `${result.name}-${idx}`, item: result })))
    );
};

const FolderView = ({ folder, onOpenFolder, onBack }) => {
    const [folderSearch, setFolderSearch] = React.useState('');
    const [activeLetter, setActiveLetter] = React.useState('');
    const isSearchableFolder = !!folder.searchableFolder;
    const normalizedFolderSearch = normalizeText(folderSearch);
    const availableLetters = React.useMemo(() => {
        return new Set((folder.children || []).map(item => getFirstLetter(item.name)));
    }, [folder]);
    const visibleChildren = React.useMemo(() => {
        if (!isSearchableFolder) return folder.children;
        if (normalizedFolderSearch) {
            return folder.children.filter(item => normalizeText(item.name).includes(normalizedFolderSearch));
        }
        if (activeLetter) {
            return folder.children.filter(item => getFirstLetter(item.name) === activeLetter);
        }
        return [];
    }, [folder, isSearchableFolder, normalizedFolderSearch, activeLetter]);
    const folderTools = isSearchableFolder && React.createElement('div', { key: 'city-tools', className: 'city-tools fade-in' }, [
        React.createElement('div', { key: 'search', className: 'relative' }, [
            React.createElement('input', {
                key: 'input',
                type: 'text',
                className: 'search-input',
                placeholder: `Buscar cidade em ${folder.name}...`,
                value: folderSearch,
                onChange: (e) => { setFolderSearch(e.target.value); setActiveLetter(''); }
            }),
            folderSearch && React.createElement('button', { key: 'clear', className: 'search-button', onClick: () => setFolderSearch('') }, React.createElement(ClearSearchIcon))
        ]),
        React.createElement('div', { key: 'letters', className: 'letter-filter scrollbar-hide' }, alphabet.map(letter => React.createElement('button', {
            key: letter,
            type: 'button',
            className: `letter-btn ${activeLetter === letter ? 'active' : ''}`,
            disabled: !availableLetters.has(letter),
            onClick: () => { setActiveLetter(activeLetter === letter ? '' : letter); setFolderSearch(''); }
        }, letter)))
    ]);
    const content = visibleChildren.length > 0
        ? React.createElement('div', { key: 'grid', className: 'grid-apps' }, visibleChildren.map((item, idx) => React.createElement(AppCard, { key: `${item.name}-${idx}`, item, onFolderOpen: onOpenFolder })))
        : (isSearchableFolder ? null : React.createElement('div', { key: 'empty', className: 'city-empty' }, 'Nenhum item encontrado.'));

    return React.createElement('div', { className: 'tray-inner' }, [
        React.createElement('div', { key: 'nav', className: 'flex items-center gap-3 mb-6' }, [
            React.createElement('button', { onClick: onBack, className: 'back-emoji-btn', title: 'Retornar', 'aria-label': 'Retornar' }, React.createElement('img', { className: 'back-image-icon', src: 'assets/icons/icons8-undo-100.png', alt: '', 'aria-hidden': 'true' })),
            React.createElement('h2', { key: 'title', className: 'text-xl font-bold text-gray-700' }, folder.name)
        ]),
        folderTools,
        content
    ]);
};

const PhoneIcon = ({ size = 26, className = '' }) => React.createElement('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': 'true'
}, React.createElement('path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.61a2 2 0 0 1-.45 2.11L8.09 9.64a16 16 0 0 0 6.27 6.27l1.2-1.2a2 2 0 0 1 2.11-.45c.84.3 1.71.51 2.61.63A2 2 0 0 1 22 16.92Z' }));

const ActionIcon = ({ name, size = 20, className = '' }) => {
    const paths = {
        Upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
        Trash: ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13', 'M10 11v5M14 11v5'],
        Settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.33.73.6 1 .3.27.68.4 1.1.4h.09v4h-.09c-.42 0-.8.13-1.1.4-.27.27-.48.62-.6 1Z'],
        Plus: ['M12 5v14', 'M5 12h14']
    };
    return React.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': 'true'
    }, (paths[name] || []).map((path, index) => React.createElement('path', { key: index, d: path })));
};

const ContactsPage = ({ user, contactStore, uploadStatus, onRequestUpload, onBack }) => {
    const store = ensureContactStore(contactStore);
    const [activeCluster, setActiveCluster] = React.useState(() => CONTACT_CLUSTERS.find(cluster => store.sheets?.[cluster]?.length) || '');
    const [activeArea, setActiveArea] = React.useState('');
    const [openNote, setOpenNote] = React.useState('');
    const sheetContacts = activeCluster ? (store.sheets?.[activeCluster] || []) : [];
    const sheetNote = activeCluster === 'CO' ? (store.sheetNotes?.[activeCluster] || '') : '';
    const noSubfilterClusters = ['BA', 'ES'];
    const defaultAllClusters = ['BA', 'ES', 'NE', 'NO', 'CO'];
    const usesAreaTabs = activeCluster && !noSubfilterClusters.includes(activeCluster);
    const areaSortWeight = (area) => {
        const normalized = normalizeText(area);
        if (normalized === 'central') return 98;
        if (normalized === 'zona da mata') return 99;
        return 0;
    };
    const areaOptions = usesAreaTabs ? Array.from(new Set(sheetContacts.map(contact => contact.area).filter(Boolean)))
        .filter(area => !(['NE', 'NO', 'CO', 'MG'].includes(activeCluster) && normalizeText(area) === normalizeText(activeCluster)))
        .sort((a, b) => areaSortWeight(a) - areaSortWeight(b)) : [];
    React.useEffect(() => {
        if (activeCluster && store.sheets?.[activeCluster]?.length) return;
        const firstCluster = CONTACT_CLUSTERS.find(cluster => store.sheets?.[cluster]?.length) || '';
        if (firstCluster !== activeCluster) {
            setActiveCluster(firstCluster);
            setActiveArea('');
        }
    }, [contactStore, activeCluster]);
    React.useEffect(() => {
        if (!usesAreaTabs) return;
        if (!areaOptions.length) {
            if (activeArea) setActiveArea('');
            return;
        }
        const hasActiveArea = areaOptions.some(area => normalizeText(area) === normalizeText(activeArea));
        if (!hasActiveArea) setActiveArea(areaOptions[0]);
    }, [activeCluster, areaOptions.join('|')]);
    React.useEffect(() => {
        if (!openNote) return undefined;
        const handleOutsideClick = (event) => {
            const target = event.target;
            if (target && typeof target.closest === 'function' && (target.closest('.contact-note-wrap') || target.closest('.contact-header-note'))) return;
            setOpenNote('');
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [openNote]);
    const normalizedArea = normalizeText(activeArea);
    const shouldShowAll = !!activeCluster && !activeArea && defaultAllClusters.includes(activeCluster);
    const shouldShowMgEmpty = activeCluster === 'MG' && !activeArea;
    const baseVisibleContacts = shouldShowMgEmpty ? [] : sheetContacts.filter(contact => {
        if (shouldShowAll) return true;
        if (!activeArea) return false;
        if (isAlwaysVisibleContact(activeCluster, contact)) return true;
        if (normalizedArea && normalizeText(contact.area) === normalizedArea) return true;
        return false;
    });
    const visibleContacts = baseVisibleContacts;
    const tableHeaders = activeCluster === 'RJ'
        ? ['Área', 'Topologia', 'Nome', 'Cargo', 'Telefone', 'Nível', '']
        : ['Área', 'Topologia', 'Nome', 'Cargo', 'Telefone', ''];
    const getNoteLines = (noteText) => String(noteText || '')
        .replace(/\r/g, '')
        .split('\n')
        .flatMap(line => line.split(/(?=\b\d{2}\/\d{2}\s*(?:a|à|A|À)\s*\d{2}\/\d{2})/))
        .map(line => line.trim())
        .filter(Boolean);
    const renderNotePopover = (noteText, extraClass = '') => {
        const lines = getNoteLines(noteText);
        return React.createElement('span', { key: 'pop', className: `contact-note-pop ${extraClass}`.trim() }, lines.map((line, index) => React.createElement('span', {
            key: `${index}-${line}`,
            className: index === 0 && !/^\d{2}\/\d{2}/.test(line) ? 'contact-note-title' : 'contact-note-line'
        }, line)));
    };
    const renderHeader = () => React.createElement('thead', { key: 'head' }, React.createElement('tr', null, tableHeaders.map(label => React.createElement('th', { key: label || 'info' },
        label === 'Telefone' && sheetNote ? React.createElement('span', { className: 'contact-header-note' }, [
            React.createElement('span', { key: 'label' }, label),
            React.createElement('button', { key: 'btn', type: 'button', className: 'contact-note-btn', onClick: () => setOpenNote(openNote === 'header-note' ? '' : 'header-note'), title: 'Ver observação', 'aria-label': 'Ver observação' }, 'i'),
            openNote === 'header-note' && renderNotePopover(sheetNote, 'contact-note-pop-wide')
        ]) : label
    ))));
    const renderRows = (contacts, keyPrefix = activeCluster) => React.createElement('tbody', { key: `body-${keyPrefix}` }, contacts.map((contact, index) => {
        const noteText = [contact.observacoes, contact.note].filter(Boolean).join('\n');
        const noteKey = `${keyPrefix}-${index}`;
        return React.createElement('tr', { key: `${keyPrefix}-${contact.area}-${contact.topologia}-${contact.nome}-${index}` }, [
            React.createElement('td', { key: 'area' }, contact.area),
            React.createElement('td', { key: 'topologia' }, contact.topologia),
            React.createElement('td', { key: 'nome' }, firstTwoNames(contact.rawNome || contact.nome)),
            React.createElement('td', { key: 'cargo' }, contact.cargo),
            React.createElement('td', { key: 'telefone' }, React.createElement('a', { className: 'whatsapp-link', href: `https://wa.me/55${contact.phoneDigits}`, target: '_blank', rel: 'noopener noreferrer' }, contact.telefone)),
            activeCluster === 'RJ' && React.createElement('td', { key: 'nivel' }, contact.nivel),
            React.createElement('td', { key: 'info', className: 'contact-info-cell' }, noteText ? React.createElement('span', { className: 'contact-note-wrap' }, [
                React.createElement('button', { key: 'btn', type: 'button', className: 'contact-note-btn', onClick: () => setOpenNote(openNote === noteKey ? '' : noteKey), title: 'Ver observação', 'aria-label': 'Ver observação' }, 'i'),
                openNote === noteKey && renderNotePopover(noteText)
            ]) : null)
        ]);
    }));
    const renderTable = (contacts, keyPrefix) => React.createElement('div', { key: `table-${keyPrefix}`, className: 'contacts-table-wrap' },
        React.createElement('table', { className: 'contacts-table' }, [renderHeader(), renderRows(contacts, keyPrefix)])
    );
    return React.createElement('div', { className: 'tray-inner contacts-page fade-in' }, [
        React.createElement('div', { key: 'nav', className: 'page-heading-row contacts-heading-row' }, [
            React.createElement('div', { key: 'title-wrap', className: 'flex items-center gap-3' }, [
                React.createElement('button', { key: 'back', type: 'button', onClick: onBack, className: 'back-emoji-btn', title: 'Retornar', 'aria-label': 'Retornar' }, React.createElement('img', { className: 'back-image-icon', src: 'assets/icons/icons8-undo-100.png', alt: '', 'aria-hidden': 'true' })),
                React.createElement('h2', { key: 'title', className: 'text-xl text-gray-700' }, 'Contatos por cluster')
            ]),
            user.role === 'admin' && React.createElement('button', { key: 'upload', type: 'button', onClick: onRequestUpload, className: 'icon-action-btn', title: 'Importar planilha de contatos', 'aria-label': 'Importar planilha de contatos' }, React.createElement(ActionIcon, { name: 'Upload', size: 20 }))
        ]),
        uploadStatus && React.createElement('p', { key: 'status', className: uploadStatus.type === 'error' ? 'system-alert error' : 'system-alert success' }, uploadStatus.text),
        React.createElement('div', { key: 'clusters', className: 'cluster-tabs' }, CONTACT_CLUSTERS.map(cluster => React.createElement('button', {
            key: cluster,
            type: 'button',
            className: `cluster-btn ${activeCluster === cluster ? 'active' : ''}`,
            onClick: () => { setActiveCluster(cluster); setActiveArea(''); setOpenNote(''); }
        }, cluster))),
        !activeCluster ? React.createElement('div', { key: 'empty-logo', className: 'contact-hero' }, React.createElement('div', { className: 'contact-phone-logo' }, React.createElement(PhoneIcon, { size: 44 }))) : [
            usesAreaTabs && React.createElement('div', { key: 'areas', className: 'area-filter-tabs contact-file-tabs' }, areaOptions.map(area => React.createElement('button', {
                key: area,
                type: 'button',
                className: `area-filter-btn contact-file-tab ${activeArea === area ? 'active' : ''}`,
                onClick: () => { setActiveArea(area); setOpenNote(''); }
            }, area))),
            visibleContacts.length === 0 ? React.createElement('div', { key: 'empty', className: 'city-empty' }, activeArea ? 'Nenhum contato encontrado para esta aba.' : 'Selecione uma área.') :
                (usesAreaTabs ? React.createElement('div', { key: 'panel', className: 'contact-tab-panel' }, renderTable(visibleContacts, `${activeCluster}-${activeArea || 'todos'}`)) : renderTable(visibleContacts, activeCluster))
        ]
    ]);
};

const DocumentsPage = ({ user, documents, uploadStatus, onRequestUpload, onOpen, onDelete, onBack }) => {
    const [openingId, setOpeningId] = React.useState('');
    const [deletingId, setDeletingId] = React.useState('');
    const [error, setError] = React.useState('');
    const openFile = async (document) => {
        setOpeningId(document.id);
        setError('');
        try { await onOpen(document); }
        catch (openError) { setError(openError.message || 'Não foi possível abrir o arquivo.'); }
        finally { setOpeningId(''); }
    };
    const deleteFile = async (document) => {
        if (!window.confirm(`Excluir "${document.file_name}"? O arquivo será removido para todos os usuários.`)) return;
        setDeletingId(document.id);
        setError('');
        try { await onDelete(document.id); }
        catch (deleteError) { setError(deleteError.message || 'Não foi possível excluir o arquivo.'); }
        finally { setDeletingId(''); }
    };
    const formatSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
    return React.createElement('div', { className: 'tray-inner documents-page fade-in' }, [
        React.createElement('div', { key: 'header', className: 'page-heading-row' }, [
            React.createElement('div', { key: 'title-wrap', className: 'flex items-center gap-3' }, [
                React.createElement('button', { key: 'back', type: 'button', onClick: onBack, className: 'back-emoji-btn', title: 'Retornar', 'aria-label': 'Retornar' }, React.createElement('img', { className: 'back-image-icon', src: 'assets/icons/icons8-undo-100.png', alt: '', 'aria-hidden': 'true' })),
                React.createElement('div', { key: 'copy' }, [
                    React.createElement('h2', { key: 'title', className: 'text-xl font-bold text-gray-700' }, 'Documentos'),
                    React.createElement('p', { key: 'subtitle', className: 'text-sm text-gray-500' }, 'Arquivos publicados por perfis Adm para toda a equipe.')
                ])
            ]),
            user.role === 'admin' && React.createElement('button', { key: 'upload', type: 'button', onClick: onRequestUpload, className: 'icon-action-btn', title: 'Anexar planilha', 'aria-label': 'Anexar planilha' }, React.createElement(ActionIcon, { name: 'Upload', size: 20 }))
        ]),
        uploadStatus && React.createElement('p', { key: 'status', className: uploadStatus.type === 'error' ? 'system-alert error' : 'system-alert success' }, uploadStatus.text),
        error && React.createElement('p', { key: 'error', className: 'system-alert error' }, error),
        documents.length === 0 ? React.createElement('div', { key: 'empty', className: 'document-empty' }, 'Nenhuma escala foi publicada ainda.') :
            React.createElement('div', { key: 'list', className: 'document-list' }, documents.map(document => React.createElement('article', { key: document.id, className: 'document-card' }, [
                React.createElement('div', { key: 'icon', className: 'document-file-icon', 'aria-hidden': 'true' }, '↧'),
                React.createElement('div', { key: 'copy', className: 'document-copy' }, [
                    React.createElement('h3', { key: 'title' }, document.title),
                    React.createElement('p', { key: 'meta' }, `${document.file_name} • ${formatSize(document.size_bytes)} • ${new Date(document.created_at).toLocaleString('pt-BR')}`)
                ]),
                React.createElement('div', { key: 'actions', className: 'document-actions' }, [
                    React.createElement('button', { key: 'open', type: 'button', disabled: openingId === document.id || deletingId === document.id, onClick: () => openFile(document), className: 'secondary-action-btn' }, openingId === document.id ? 'Abrindo...' : 'Abrir'),
                    user.role === 'admin' && React.createElement('button', { key: 'delete', type: 'button', disabled: !!deletingId, onClick: () => deleteFile(document), className: 'danger-icon-btn', title: 'Excluir documento', 'aria-label': `Excluir ${document.file_name}` }, deletingId === document.id ? '…' : React.createElement(ActionIcon, { name: 'Trash', size: 18 }))
                ])
            ])))
    ]);
};

const UserAdminPage = ({ currentUser, profiles, onCreate, onDelete, onBack }) => {
    const [form, setForm] = React.useState({ displayName: '', email: '', password: '', role: 'user', groupId: 'Residencial' });
    const [status, setStatus] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState('');
    const formatGroupName = (group) => normalizeText(group) === 'residencial' ? 'Residencial' : String(group || '');
    const orderedProfiles = [...profiles].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? 1 : -1;
        return a.displayName.localeCompare(b.displayName, 'pt-BR');
    });
    const update = (field) => (event) => setForm(previous => ({ ...previous, [field]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setStatus(null);
        try {
            await onCreate(form);
            setForm({ displayName: '', email: '', password: '', role: 'user', groupId: 'Residencial' });
            setStatus({ type: 'success', text: 'Usuário criado. Entregue o e-mail e a senha inicial por um canal seguro.' });
        } catch (createError) {
            setStatus({ type: 'error', text: createError.message || 'Não foi possível criar o usuário.' });
        } finally { setLoading(false); }
    };
    const remove = async (profile) => {
        if (profile.id === currentUser.id) return;
        if (!window.confirm(`Excluir o acesso de ${profile.displayName} ao SIM?`)) return;
        setDeletingId(profile.id);
        setStatus(null);
        try {
            await onDelete(profile.id);
            setStatus({ type: 'success', text: `${profile.displayName} não tem mais acesso ao SIM.` });
        } catch (deleteError) {
            setStatus({ type: 'error', text: deleteError.message || 'Não foi possível excluir o usuário.' });
        } finally { setDeletingId(''); }
    };
    return React.createElement('div', { className: 'tray-inner user-admin-page fade-in' }, [
        React.createElement('div', { key: 'nav', className: 'user-admin-header flex items-center gap-3' }, [
            React.createElement('button', { key: 'back', type: 'button', onClick: onBack, className: 'back-emoji-btn', title: 'Retornar', 'aria-label': 'Retornar' }, React.createElement('img', { className: 'back-image-icon', src: 'assets/icons/icons8-undo-100.png', alt: '', 'aria-hidden': 'true' })),
            React.createElement('div', { key: 'copy' }, [
                React.createElement('h2', { key: 'title', className: 'text-xl font-bold text-gray-700' }, 'Usuários do SIM'),
                React.createElement('p', { key: 'subtitle', className: 'text-sm text-gray-500' }, 'Crie contas individuais; senhas nunca são armazenadas no código.')
            ])
        ]),
        React.createElement('div', { key: 'scroll', className: 'user-admin-scroll' }, [
            React.createElement('form', { key: 'form', onSubmit: submit, className: 'user-create-form' }, [
                React.createElement('input', { key: 'name', required: true, maxLength: 120, className: 'search-input', placeholder: 'Nome completo', value: form.displayName, onChange: update('displayName') }),
                React.createElement('input', { key: 'email', required: true, type: 'email', autoComplete: 'off', className: 'search-input', placeholder: 'E-mail corporativo', value: form.email, onChange: update('email') }),
                React.createElement('input', { key: 'password', required: true, minLength: 8, type: 'password', autoComplete: 'new-password', className: 'search-input user-password-input', placeholder: 'claro123', value: form.password, onChange: update('password') }),
                React.createElement('select', { key: 'role', className: 'search-input', value: form.role, onChange: update('role') }, [
                    React.createElement('option', { key: 'user', value: 'user' }, 'User'),
                    React.createElement('option', { key: 'admin', value: 'admin' }, 'Adm')
                ]),
                React.createElement('input', { key: 'group', required: true, maxLength: 80, className: 'search-input', placeholder: 'Grupo', value: form.groupId, onChange: update('groupId') }),
                React.createElement('button', { key: 'submit', type: 'submit', disabled: loading, className: 'primary-action-btn create-user-icon-btn', title: 'Criar usuário', 'aria-label': 'Criar usuário' }, loading ? '…' : React.createElement(ActionIcon, { name: 'Plus', size: 20 }))
            ]),
            status && React.createElement('p', { key: 'status', className: status.type === 'error' ? 'system-alert error' : 'system-alert success' }, status.text),
            React.createElement('div', { key: 'members', className: 'member-list' }, orderedProfiles.map(profile => React.createElement('div', { key: profile.id, className: 'member-row' }, [
                React.createElement('span', { key: 'name' }, profile.role === 'admin' ? profile.displayName.toLocaleUpperCase('pt-BR') : profile.displayName),
                React.createElement('span', { key: 'role', className: `role-pill ${profile.role}` }, profile.role === 'admin' ? 'Adm' : 'User'),
                React.createElement('span', { key: 'group', className: 'member-group' }, formatGroupName(profile.group)),
                React.createElement('button', {
                    key: 'delete', type: 'button',
                    disabled: profile.id === currentUser.id || !!deletingId,
                    onClick: () => remove(profile),
                    className: 'danger-icon-btn',
                    title: profile.id === currentUser.id ? 'Você não pode excluir a própria conta' : 'Excluir usuário',
                    'aria-label': profile.id === currentUser.id ? 'Não é possível excluir sua própria conta' : `Excluir ${profile.displayName}`
                }, deletingId === profile.id ? '…' : React.createElement(ActionIcon, { name: 'Trash', size: 17 }))
            ])))
        ])
    ]);
};

const MessageCenter = ({ user, profiles, messages, onSend, onConfirm, onDelete, onClose }) => {
    const teamsLoginIds = new Set(['N0238475', 'N5923221', 'N5772086', 'N0239871', 'F104752', 'N5972428', 'N4014011', 'F106664']);
    const [selectedRecipientIds, setSelectedRecipientIds] = React.useState([]);
    const [title, setTitle] = React.useState('');
    const [text, setText] = React.useState('');
    const [sendToTeams, setSendToTeams] = React.useState(false);
    const [status, setStatus] = React.useState(null);
    const [loadingId, setLoadingId] = React.useState('');
    const [selected, setSelected] = React.useState([]);
    const [deleteMode, setDeleteMode] = React.useState(false);
    const recipientProfiles = profiles.filter(profile => profile.role !== 'admin').sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    const profileMap = new Map(recipientProfiles.map(profile => [profile.id, profile]));
    const groups = Array.from(new Set(recipientProfiles.map(profile => profile.group).filter(Boolean)));
    const selectedProfiles = recipientProfiles.filter(profile => selectedRecipientIds.includes(profile.id));
    const groupMembers = (group) => recipientProfiles.filter(profile => normalizeText(profile.group) === normalizeText(group));
    const isGroupSelected = (group) => {
        const members = groupMembers(group);
        return members.length > 0 && members.every(profile => selectedRecipientIds.includes(profile.id));
    };
    const toggleGroup = (group) => {
        const memberIds = groupMembers(group).map(profile => profile.id);
        setSelectedRecipientIds(previous => memberIds.every(id => previous.includes(id)) ? previous.filter(id => !memberIds.includes(id)) : Array.from(new Set([...previous, ...memberIds])));
    };
    const toggleRecipient = (profileId) => setSelectedRecipientIds(previous => previous.includes(profileId) ? previous.filter(id => id !== profileId) : [...previous, profileId]);
    const fullySelectedGroup = groups.find(group => isGroupSelected(group) && groupMembers(group).length === selectedRecipientIds.length);
    const teamsAvailable = selectedProfiles.length > 0 && (Boolean(fullySelectedGroup) || selectedProfiles.every(profile => teamsLoginIds.has(profile.loginId)));
    const teamsTargets = fullySelectedGroup ? [`group:${fullySelectedGroup}`] : selectedRecipientIds;
    const formatGroupName = (group) => normalizeText(group) === 'residencial' ? 'Residencial' : String(group || '');
    const targetLabel = (value) => Array.isArray(value)
        ? (value.map(id => profileMap.get(id)?.displayName).filter(Boolean).join(', ') || 'Destinatários selecionados')
        : (value === 'todos' ? 'Todos' : (String(value).startsWith('group:') ? `Grupo ${formatGroupName(String(value).slice(6))}` : (profileMap.get(value)?.displayName || 'Usuário')));
    const send = async () => {
        if (!title.trim()) return setStatus({ type: 'error', text: 'Informe o título da mensagem.' });
        if (!selectedRecipientIds.length) return setStatus({ type: 'error', text: 'Selecione pelo menos um destinatário.' });
        setLoadingId('send'); setStatus(null);
        try {
            const result = await onSend({ recipientIds: selectedRecipientIds, teamsTargets, title, text, sendToTeams });
            setTitle(''); setText('');
            setSelectedRecipientIds([]);
            setSendToTeams(false);
            setStatus({ type: 'success', text: result?.teamsSent ? 'Mensagem enviada no SIM e no Teams.' : 'Mensagem enviada e armazenada no SIM.' });
        } catch (sendError) { setStatus({ type: sendError.internalSaved ? 'warning' : 'error', text: sendError.message || 'Falha ao enviar.' }); }
        finally { setLoadingId(''); }
    };
    const confirm = async (message) => {
        setLoadingId(message.id); setStatus(null);
        try { await onConfirm(message.id); }
        catch (confirmError) { setStatus({ type: 'error', text: confirmError.message || 'Falha ao confirmar.' }); }
        finally { setLoadingId(''); }
    };
    const removeSelected = async () => {
        setLoadingId('delete'); setStatus(null);
        try { await onDelete(selected); setSelected([]); setDeleteMode(false); }
        catch (deleteError) { setStatus({ type: 'error', text: deleteError.message || 'Falha ao apagar.' }); }
        finally { setLoadingId(''); }
    };
    const exportPdf = () => {
        const escape = (value) => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
        const rows = messages.flatMap(message => message.readBy.map(receipt => `<tr><td>${escape(receipt.displayName)}</td><td>${escape(receipt.date)}</td><td>${escape(message.title)}</td></tr>`)).join('');
        const report = window.open('', '_blank');
        if (!report) return;
        report.document.write(`<html><head><title>Confirmações SIM</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left}th{background:#fee2e2}</style></head><body><h1>Confirmações de leitura</h1><table><thead><tr><th>Usuário</th><th>Data</th><th>Mensagem</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhuma confirmação.</td></tr>'}</tbody></table></body></html>`);
        report.document.close(); report.focus(); report.print();
    };
    return React.createElement('div', { className: 'modal-overlay', onClick: event => event.target === event.currentTarget && onClose() },
        React.createElement('div', { className: 'modal-card message-center-card p-5' }, [
            React.createElement('div', { key: 'header', className: 'message-center-header flex items-center justify-between' }, [
                React.createElement('h2', { key: 'title', className: 'text-xl font-bold text-red-700' }, 'Central de Mensagens'),
                React.createElement('div', { key: 'actions', className: 'modal-header-actions' }, [
                    user.role === 'admin' && React.createElement('button', { key: 'pdf', type: 'button', onClick: exportPdf, className: 'secondary-action-btn' }, 'PDF'),
                    user.role === 'admin' && React.createElement('button', { key: 'delete', type: 'button', onClick: () => { setDeleteMode(!deleteMode); setSelected([]); }, className: 'secondary-action-btn' }, deleteMode ? 'Cancelar' : 'Apagar'),
                    React.createElement('button', { key: 'close', type: 'button', onClick: onClose, className: 'header-btn', 'aria-label': 'Fechar' }, '×')
                ])
            ]),
            React.createElement('div', { key: 'scroll', className: 'message-center-scroll' }, [
                status && React.createElement('p', { key: 'status', className: `system-alert ${status.type}` }, status.text),
                user.role === 'admin' && React.createElement('section', { key: 'composer', className: 'message-composer' }, [
                    React.createElement('h3', { key: 'heading' }, 'Enviar mensagem'),
                    React.createElement('div', { key: 'recipients', className: 'message-recipient-panel' }, [
                        React.createElement('p', { key: 'label', className: 'message-recipient-title' }, `Destinatários • ${selectedRecipientIds.length} selecionado(s)`),
                        React.createElement('div', { key: 'groups', className: 'message-recipient-groups' }, groups.map(group => React.createElement('label', { key: group, className: 'message-recipient-option group-option' }, [
                            React.createElement('input', { key: 'checkbox', type: 'checkbox', checked: isGroupSelected(group), onChange: () => { toggleGroup(group); setSendToTeams(false); }, 'aria-label': `Grupo ${formatGroupName(group)}` }),
                            React.createElement('span', { key: 'name', className: 'recipient-name' }, `Grupo ${formatGroupName(group)}`),
                            React.createElement('small', { key: 'count' }, `${groupMembers(group).length} pessoas`)
                        ]))),
                        React.createElement('div', { key: 'people', className: 'message-recipient-list' }, recipientProfiles.map(profile => React.createElement('label', { key: profile.id, className: 'message-recipient-option' }, [
                            React.createElement('input', { key: 'checkbox', type: 'checkbox', checked: selectedRecipientIds.includes(profile.id), onChange: () => { toggleRecipient(profile.id); setSendToTeams(false); }, 'aria-label': profile.displayName }),
                            React.createElement('span', { key: 'name', className: 'recipient-name' }, profile.displayName)
                        ])))
                    ]),
                    React.createElement('input', { key: 'title', maxLength: 160, className: 'search-input', placeholder: 'Título', value: title, onChange: event => setTitle(event.target.value) }),
                    React.createElement('textarea', { key: 'body', maxLength: 5000, rows: 3, className: 'search-input', placeholder: 'Mensagem', value: text, onChange: event => setText(event.target.value) }),
                    React.createElement('label', { key: 'teams', className: `teams-send-option ${teamsAvailable ? '' : 'disabled'}` }, [
                        React.createElement('input', { key: 'checkbox', type: 'checkbox', checked: sendToTeams, disabled: !teamsAvailable, onChange: event => setSendToTeams(event.target.checked) }),
                        React.createElement('span', { key: 'label' }, teamsAvailable ? 'Enviar também no Microsoft Teams' : 'Teams indisponível para parte dos destinatários selecionados')
                    ]),
                    React.createElement('button', { key: 'send', type: 'button', disabled: loadingId === 'send' || !selectedRecipientIds.length, onClick: send, className: 'primary-action-btn' }, loadingId === 'send' ? 'Enviando...' : 'Enviar mensagem')
                ]),
                user.role === 'admin' && deleteMode && React.createElement('div', { key: 'delete-bar', className: 'delete-bar' }, [
                    React.createElement('span', { key: 'count' }, `${selected.length} selecionada(s)`),
                    React.createElement('button', { key: 'confirm', type: 'button', disabled: !selected.length || loadingId === 'delete', onClick: removeSelected, className: 'delete-confirm-btn' }, 'Apagar selecionadas')
                ]),
                React.createElement('div', { key: 'list', className: 'message-list space-y-3' }, messages.length === 0 ? React.createElement('p', { className: 'text-center text-gray-500 py-8' }, 'Nenhuma mensagem disponível.') : messages.map(message => {
                    const ownReceipt = message.readBy.find(receipt => receipt.username === user.id);
                    return React.createElement('article', { key: message.id, className: 'message-detail-body border rounded-2xl p-4' }, [
                        user.role === 'admin' && deleteMode && React.createElement('input', { key: 'check', type: 'checkbox', checked: selected.includes(message.id), onChange: () => setSelected(previous => previous.includes(message.id) ? previous.filter(id => id !== message.id) : [...previous, message.id]) }),
                        React.createElement('p', { key: 'meta', className: 'text-xs text-gray-500' }, `${message.date} • De: ${message.from} • Para: ${targetLabel(message.to)}`),
                        React.createElement('h3', { key: 'title', className: 'font-bold mt-1' }, message.title),
                        message.text && React.createElement('p', { key: 'body', className: 'text-sm mt-1' }, message.text),
                        user.role === 'admin' ? React.createElement('div', { key: 'receipts', className: 'message-receipts' }, message.readBy.length ? message.readBy.map(receipt => React.createElement('p', { key: receipt.username }, `Confirmada por ${receipt.displayName} em ${receipt.date}`)) : React.createElement('p', null, 'Nenhuma confirmação ainda.')) :
                            (ownReceipt ? React.createElement('p', { key: 'done', className: 'read-confirmed' }, `Recebida e lida em ${ownReceipt.date}`) : React.createElement('button', { key: 'confirm', type: 'button', disabled: loadingId === message.id, onClick: () => confirm(message), className: 'confirm-read-btn mt-3' }, loadingId === message.id ? 'Confirmando...' : 'Confirmar leitura'))
                    ]);
                }))
            ])
        ])
    );
};
