(() => {
  // INICIALIZACIÓN Y CACHEO DE ELEMENTOS
  const chatSidebar = document.getElementById('chatSidebar');
  const chatHistory = document.getElementById('chatHistory');
  const chatMessages = document.getElementById('chatMessages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const newChatBtn = document.querySelector('.new-chat-btn');
  const deleteChatsBtn = document.querySelector('.delete-chats-btn');

  let currentChatId = null;
  let currentOptionsMenu = null;
  let abortController = null;
  let chats = JSON.parse(localStorage.getItem('arexChats')) || [];

  // GESTIÓN DEL HISTORIAL DE CHATS
  const saveChatsToStorage = () => {
    purgeOldChats();
    localStorage.setItem('arexChats', JSON.stringify(chats));

    if (localStorage.getItem('isLoggedIn') === 'true') {
      chats.forEach(chat => {
        saveChatToServer({
          chatId: chat.id,
          name: chat.name,
          messages: chat.messages,
          timestamp: chat.timestamp
        });
      });
    }
  };

  const loadChatHistory = () => {
    const sortedChats = [...chats].sort((a, b) => b.timestamp - a.timestamp);
    chatHistory.innerHTML = sortedChats
      .map(
        (chat) => `
        <li class="chat-item ${chat.id === currentChatId ? 'active' : ''}" data-id="${chat.id}">
          <div class="chat-info">
            <span>${chat.name || new Date(chat.timestamp).toLocaleString()}</span>
          </div>
          <button class="chat-options-btn" aria-label="Opciones del chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="6" r="1"></circle>
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="18" r="1"></circle>
            </svg>
          </button>
        </li>
      `
      )
      .join('');

    chatHistory.querySelectorAll('.chat-item').forEach((item) => {
      item.addEventListener('click', () => {
        currentChatId = item.dataset.id;
        localStorage.setItem('selectedChatId', currentChatId);
        loadChatHistory();
        loadChatMessages();
      });
    });

    chatHistory.querySelectorAll('.chat-options-btn').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = button.closest('.chat-item').dataset.id;
        showChatOptions(chatId);
      });
    });
  };

  // Función para mostrar una alerta personalizada
  function showCustomAlert(message) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.classList.add('custom-alert-overlay');
      modal.innerHTML = `
        <div class="custom-alert-box">
          <p>${message}</p>
          <button id="customAlertOk">Aceptar</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('customAlertOk').addEventListener('click', () => {
        modal.remove();
        resolve();
      });
    });
  }

  async function fetchChatsFromServer() {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://arex-backend.vercel.app/api/chats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener chats');
      const serverChats = await response.json();

      return serverChats.map(chat => ({
        ...chat,
        id: chat.chatId  
      }));
    } catch (err) {
      console.error('Fallo al cargar chats desde el servidor:', err);
      return [];
    }
  }

  async function saveChatToServer(chat) {
    try {
      const token = localStorage.getItem('authToken');
      await fetch('https://arex-backend.vercel.app/api/save-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chat)
      });
    } catch (err) {
      console.error('Error al guardar chat en servidor:', err);
    }
  }

  // Función para mostrar un diálogo de confirmación personalizado
  function showCustomDelete(message) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.classList.add('custom-alert-overlay');
      modal.innerHTML = `
        <div class="custom-alert-box">
          <p>${message}</p>
          <button id="customDeleteNo">Cancelar</button>
          <button id="customDeleteYes">Eliminar</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('customDeleteYes').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });
      document.getElementById('customDeleteNo').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });
    });
  }

  // Función para mostrar un diálogo de entrada personalizado (prompt)
  function showCustomPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.classList.add('custom-alert-overlay');
      modal.innerHTML = `
        <div class="custom-alert-box">
          <p>${message}</p>
          <input id="customPromptInput" type="text" value="${defaultValue}" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid var(--color-border);">
          <button id="customPromptOk">Aceptar</button>
          <button id="customPromptCancel">Cancelar</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('customPromptOk').addEventListener('click', () => {
        const input = document.getElementById('customPromptInput').value;
        modal.remove();
        resolve(input);
      });
      document.getElementById('customPromptCancel').addEventListener('click', () => {
        modal.remove();
        resolve(null);
      });
      document.getElementById('customPromptInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('customPromptOk').click();
        }
      });
    });
  }

  // MENÚ DE CAMBIO DE TÍTULO
  document.getElementById('headerTitleToggleBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    let menu = document.getElementById('headerTitleMenu');
    if (menu) {
      menu.remove();
      return;
    }
    menu = document.createElement('div');
    menu.id = 'headerTitleMenu';
    menu.className = 'header-title-menu';
    menu.style.position = 'absolute';
    menu.style.top = this.offsetTop + this.offsetHeight + 'px';
    menu.style.left = this.offsetLeft + 'px';
    menu.style.backgroundColor = '#222';
    menu.style.border = '1px solid #333';
    menu.style.borderRadius = '8px';
    menu.style.padding = '4px 0';
    menu.style.zIndex = '1000';

    function createOption(title, description, descriptionColor, disabled = false) {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.cursor = disabled ? 'not-allowed' : 'pointer';
      container.style.padding = '8px 16px';
      container.style.transition = 'background-color 0.3s ease';

      const updateBackground = () => {
        if (disabled) return;
        const storedTitle = localStorage.getItem('chatHeaderTitle') || 'AREX';
        if (storedTitle === title) {
          container.classList.add('active');
          container.style.backgroundColor = 'rgba(227,227,227,0.1)';
        } else {
          container.classList.remove('active');
          container.style.backgroundColor = 'transparent';
        }
      };

      container.addEventListener('mouseenter', function () {
        if (!disabled) container.style.backgroundColor = '#333';
      });
      container.addEventListener('mouseleave', function () {
        if (!disabled) updateBackground();
      });

      if (!disabled) {
        container.addEventListener('click', function () {
          const siblings = container.parentElement.children;
          for (let sibling of siblings) {
            sibling.classList.remove('active');
            sibling.style.backgroundColor = 'transparent';
          }
          container.classList.add('active');
          container.style.backgroundColor = 'rgba(227,227,227,0.1)';
          document.getElementById('chatHeaderTitle').textContent = title;
          localStorage.setItem('chatHeaderTitle', title);
          menu.remove();
        });
      } else {
        container.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
        });
      }

      const titleElem = document.createElement('div');
      titleElem.textContent = title;
      titleElem.style.background = 'none';
      titleElem.style.border = 'none';
      titleElem.style.color = '#fff';
      titleElem.style.fontWeight = 'bold';
      titleElem.style.fontSize = '16px';

      const storedTitle = localStorage.getItem('chatHeaderTitle') || 'AREX';
      if (storedTitle === title && !disabled) {
        container.classList.add('active');
        container.style.backgroundColor = 'rgba(227,227,227,0.1)';
      }

      const desc = document.createElement('div');
      desc.textContent = description;
      desc.style.fontSize = '12px';
      desc.style.color = descriptionColor;
      desc.style.marginTop = '4px';

      container.appendChild(titleElem);
      container.appendChild(desc);

      return container;
    }

    const optionArexThinking = createOption('AREX THINKING', 'Modo de razonamiento avanzado (Versión Alpha)', '#ADB0B4');
    const optionArexDeluxe = createOption('AREX DELUXE', 'Tareas complejas que requieren alta precisión y comprensión profunda.', '#ADB0B4');
    const optionArexGold = createOption('AREX GOLD', 'Tareas moderadamente complejas o simples con mayor precisión.', '#ADB0B4');
    const optionArex = createOption('AREX', 'Tareas simples donde la rapidez es una prioridad.', '#ADB0B4');

    menu.appendChild(optionArexThinking);
    menu.appendChild(optionArexDeluxe);
    menu.appendChild(optionArexGold);
    menu.appendChild(optionArex);

    menu.addEventListener('click', (e) => e.stopPropagation());
    this.parentElement.appendChild(menu);

    document.addEventListener('click', function closeMenu(event) {
      if (!menu.contains(event.target) && event.target !== document.getElementById('headerTitleToggleBtn')) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    let storedTitle = localStorage.getItem('chatHeaderTitle');
    if (!storedTitle) {
      storedTitle = 'AREX';
      localStorage.setItem('chatHeaderTitle', storedTitle);
    }
    document.getElementById('chatHeaderTitle').textContent = storedTitle;

    if (localStorage.getItem('redirectAfterLogin') === 'arex') {
      localStorage.removeItem('redirectAfterLogin');
    }
  });

  // === CONFIGURACIÓN DE LIMPIEZA AUTOMÁTICA ===============================
  const MAX_CHAT_AGE = 30 * 24 * 60 * 60 * 1000;   

  function purgeOldChats() {                       
    const cutoff = Date.now() - MAX_CHAT_AGE;
    chats = chats.filter(chat => chat.timestamp >= cutoff);
  }

  // FUNCIONALIDAD DE BÚSQUEDA Y CARGA DE ARCHIVOS
  const searchWebBtn = document.getElementById('search-web-btn');
  const fileUploadInput = document.getElementById('file-upload');
  const fileUploadBtn = document.querySelector('.file-upload-btn');
  let searchActive = false;

  searchWebBtn.addEventListener('click', function () {
    searchActive = !searchActive;
    if (searchActive) {
      searchWebBtn.classList.add('active');
      fileUploadInput.disabled = true;
      fileUploadBtn.classList.add('disabled');
    } else {
      searchWebBtn.classList.remove('active');
      fileUploadInput.disabled = false;
      fileUploadBtn.classList.remove('disabled');
    }
  });

  // === ACTUALIZAR TIMESTAMP DEL CHAT ACTUAL ===============================
  function touchCurrentChat() {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) chat.timestamp = Date.now();
  }

  // MENÚ DE OPCIONES DE CHAT
  const showChatOptions = (chatId) => {
    const button = document.querySelector(`.chat-item[data-id="${chatId}"] .chat-options-btn`);
    if (currentOptionsMenu && currentOptionsMenu.parentElement === button.parentElement) {
      currentOptionsMenu.remove();
      currentOptionsMenu = null;
      return;
    }
    if (currentOptionsMenu) {
      currentOptionsMenu.remove();
      currentOptionsMenu = null;
    }
    const menu = document.createElement('div');
    menu.className = 'chat-options-menu';
    Object.assign(menu.style, {
      position: 'absolute',
      right: '0',
      top: '100%',
      backgroundColor: '#111',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '0.5rem 0',
      zIndex: '1000',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column'
    });

    const renameOption = document.createElement('button');
    renameOption.className = 'chat-option';
    renameOption.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
      </svg>
      Renombrar
    `;
    renameOption.addEventListener('click', async () => {
      const newName = await showCustomPrompt("Introduce un nuevo nombre para este chat:", document.querySelector(`.chat-item[data-id="${chatId}"] .chat-info span`).textContent);
      if (newName && newName.trim()) {
        renameChat(chatId, newName.trim());
      }
      menu.remove();
      currentOptionsMenu = null;
    });    

    const deleteOption = document.createElement('button');
    deleteOption.className = 'chat-option';
    deleteOption.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
      </svg>
      Eliminar
    `;
    deleteOption.addEventListener('click', async () => {
      const confirmDelete = await showCustomDelete("¿Estás seguro de que quieres eliminar este chat?");
      if (confirmDelete) {
        deleteChat(chatId);
      }
      menu.remove();
      currentOptionsMenu = null;
    });    

    menu.append(renameOption, deleteOption);
    button.parentElement.appendChild(menu);
    currentOptionsMenu = menu;

    const handleOutsideClick = (e) => {
      if (currentOptionsMenu && !currentOptionsMenu.contains(e.target)) {
        currentOptionsMenu.remove();
        currentOptionsMenu = null;
        document.removeEventListener('click', handleOutsideClick);
      }
    };
    document.addEventListener('click', handleOutsideClick);
  };

  const renameChat = (chatId, newName) => {
    const chat = chats.find((chat) => chat.id === chatId);
    if (chat) {
      chat.name = newName;
      saveChatsToStorage();    
      loadChatHistory();         
    }
  };

  const deleteChat = (chatId) => {
    chats = chats.filter((chat) => chat.id !== chatId);
    saveChatsToStorage();
    loadChatHistory();
    if (currentChatId === chatId) chatMessages.innerHTML = '';

    if (localStorage.getItem('isLoggedIn') === 'true') {
      const token = localStorage.getItem('authToken');
      fetch('https://arex-backend.vercel.app/api/delete-chat', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chatId })
      }).catch(err => console.error('Error al eliminar chat en servidor:', err));
    }
  };

  // MENSAJES Y NUEVO CHAT
  const loadChatMessages = () => {
    const chat = chats.find((c) => c.id === currentChatId);
    if (!chat) return;
    chatMessages.innerHTML = '';
    chat.messages.forEach((msg) => {
      if (msg.isUser) {
        displayMessage(msg.displayContent || msg.content, true);
      } else {
        displayMessage(msg.content, false, { fuentesData: msg.fuentesData });
      }
    });
  };

  const createNewChat = () => {
    currentChatId = Date.now().toString();
    const welcomeMessage = "¡Hola! Soy Arex, el asistente de IA de Anuvyx.\n\n¿En qué puedo ayudarte hoy?\n";
    chats.push({
      id: currentChatId,
      timestamp: Date.now(),
      name: 'New chat',
      messages: [
        {
          content: welcomeMessage,
          isUser: false,
          timestamp: Date.now()
        }
      ]
    });
    saveChatsToStorage();
    localStorage.setItem('selectedChatId', currentChatId);
    loadChatHistory();
    loadChatMessages();
  };

  // INDICADOR DE CARGA
  const showLoadingWithCounter = () => {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.alignItems = 'center';
    loadingDiv.style.gap = '10px';

    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
      border: '4px solid rgba(255, 255, 255, 0.2)',
      borderTop: '4px solid #ffffff',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      animation: 'spin 1s linear infinite'
    });

    const counter = document.createElement('span');
    let countdown = 60;
    counter.textContent = countdown;
    counter.style.fontSize = '1.2rem';
    counter.style.color = '#ffffff';
    counter.style.fontWeight = 'bold';

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown >= 0) counter.textContent = countdown;
      else clearInterval(countdownInterval);
    }, 1000);

    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(counter);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return { loadingDiv, countdownInterval };
  };

  function appendCopyButton(messageDiv, rawContent, isUser) {
    const copyButtonContainer = document.createElement('div');
    copyButtonContainer.style.display = 'flex';
    copyButtonContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';
    copyButtonContainer.style.marginTop = '5px';

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.style.padding = '5px';
    copyButton.style.backgroundColor = 'transparent';
    copyButton.style.border = 'none';
    copyButton.style.cursor = 'pointer';
    copyButton.style.display = 'flex';
    copyButton.style.alignItems = 'center';
    copyButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#ffffff" stroke-width="2">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6
                a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
    `;

    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(rawContent).then(() => {
        copyButton.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#ffffff" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        setTimeout(() => {
          copyButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          `;
        }, 2000);
      });
    });

    copyButtonContainer.appendChild(copyButton);

    if (!isUser && rawContent !== "¡Hola! Soy Arex, el asistente de IA de Anuvyx.\n\n¿En qué puedo ayudarte hoy?\n") {
      const reloadButton = document.createElement('button');
      reloadButton.className = 'reload-button';
      reloadButton.style.padding = '5px';
      reloadButton.style.backgroundColor = 'transparent';
      reloadButton.style.border = 'none';
      reloadButton.style.cursor = 'pointer';
      reloadButton.style.display = 'flex';
      reloadButton.style.alignItems = 'center';
      reloadButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
          <path d="M20.49 15A9 9 0 0 1 5.85 18.36L1 14"></path>
        </svg>
      `;

      reloadButton.addEventListener('click', () => {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        const lastBotIndex = [...chat.messages].reverse().findIndex(m => !m.isUser && m.content === rawContent);
        if (lastBotIndex !== -1) {
          const trueIndex = chat.messages.length - 1 - lastBotIndex;
          chat.messages = chat.messages.slice(0, trueIndex);
          saveChatsToStorage();
          loadChatMessages();
          resendAfterEdit();
        }
      });

      copyButtonContainer.appendChild(reloadButton);
    }

    messageDiv.after(copyButtonContainer); 
  }

  // MEJORA DEL FORMATO DE LOS MENSAJES
  function enhanceMessage(messageDiv) {
    const codeBlocks = messageDiv.querySelectorAll('pre > code');
    codeBlocks.forEach((codeBlock) => {
      const preBlock = codeBlock.parentElement;

      if (preBlock.previousElementSibling && preBlock.previousElementSibling.classList.contains('code-header')) {
        return;
      }

      const language = codeBlock.className.replace('language-', '') || 'plaintext';
      const header = document.createElement('div');
      header.classList.add('code-header');

      const languageSpan = document.createElement('span');
      languageSpan.textContent = language;

      const copyIcon = document.createElement('button');
      copyIcon.classList.add('copy-icon');
      copyIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
      `;

      copyIcon.addEventListener('click', () => {
        navigator.clipboard.writeText(codeBlock.textContent)
          .then(() => {
            copyIcon.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            setTimeout(() => {
              copyIcon.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              `;
            }, 2000);
          });
      });

      header.appendChild(languageSpan);
      header.appendChild(copyIcon);
      preBlock.parentElement.insertBefore(header, preBlock);
      preBlock.classList.add('line-numbers');
      preBlock.setAttribute('data-lang', language);
      Prism.highlightElement(codeBlock);
    });

    if (typeof MathJax !== 'undefined') {
      MathJax.typesetPromise([messageDiv]).catch((err) => console.error('MathJax error:', err));
    }
  }

  // ENVÍO DE MENSAJES Y RESPUESTA DE LA API
  const sendMessage = async () => {
    const userText = userInput.value.trim();
    const filePreviews = document.querySelectorAll('.file-preview');
    const fileNames = [];
    let fileContent = '';

    filePreviews.forEach((preview) => {
      const fileName = preview.dataset.filename;
      const content = preview.dataset.content;
      fileNames.push(`[${fileName}]`);
      fileContent += '\n\n' + content;
    });

    const displayMessageContent = (fileNames.join('\n') + (userText ? '\n\n' + userText : '')).trim();
    const apiMessageContent = (userText + fileContent).trim();
    if (!apiMessageContent) return;

    const chat = chats.find((c) => c.id === currentChatId);

    if (searchActive) {
      chat.messages.push({
        content: userText,
        isUser: true,
        timestamp: Date.now()
      });
      touchCurrentChat();
      saveChatsToStorage();
      displayMessage(userText, true);
      userInput.value = '';
      autoResizeTextarea();

      const { loadingDiv, countdownInterval } = showLoadingWithCounter();
      abortController = new AbortController();
      sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `;
      sendBtn.style.backgroundColor = '#FF0000E6';
      sendBtn.onclick = cancelRequest;

      try {
        const response = await fetch('https://arex-backend.vercel.app/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userText }),
          signal: abortController.signal
        });
        const data = await response.json();

        let fuentes = '';
        if (data.results && data.results.length > 0) {
          fuentes = data.results
            .map((result, index) => {
              const snippet = result.snippet.length > 150 ? result.snippet.substring(0, 150) + '...' : result.snippet;
              return `${index + 1}. ${result.title} (${result.url})\n${snippet}`;
            })
            .join('\n\n');
        } else {
          fuentes = 'No se encontraron resultados.';
        }

        const prompt = `
        Pregunta: ${userText}

        Utiliza la siguiente información obtenida de internet para responder de forma precisa:

        Fuentes:
        ${fuentes}

        Responde de manera concisa y precisa, evitando información irrelevante o redundante. Únicamente escribe las referencias de las fuentes consultadas entre corchetes a lo largo del texto (Ejemplo: Texto[n]).
        `.trim();

        const chatResponse = await fetch('https://arex-backend.vercel.app/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            chatHeaderTitle: document.getElementById('chatHeaderTitle').textContent
          })
        });

        const botMessageDiv = document.createElement('div');
        botMessageDiv.className = 'message bot-message';
        chatMessages.appendChild(botMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const reader = chatResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let botResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line.startsWith('data:')) {
              let jsonStr = line.replace(/^(data:\s*)+/i, '');
              if (jsonStr === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                if (
                  parsed.choices &&
                  parsed.choices.length > 0 &&
                  parsed.choices[0].delta
                ) {
                  const delta = parsed.choices[0].delta;
                  if (delta.reasoning_content) {
                    if (!window.reasoningContainer) {
                      const reasoningDiv = document.createElement('div');
                      reasoningDiv.className = 'message bot-message reasoning-message';
                      reasoningDiv.innerHTML = `<strong>Pensamiento:</strong><br><span class="reasoning-text"></span>`;
                      chatMessages.insertBefore(reasoningDiv, botMessageDiv);
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                      window.reasoningContainer = reasoningDiv.querySelector('.reasoning-text');
                    }
                    window.reasoningContainer.innerHTML += delta.reasoning_content;
                  }
                  if (delta.content) {
                    botResponse += delta.content;
                  }
                }
              } catch (error) {
                console.error("Error al parsear JSON:", error);
              }
            }
          }
          botMessageDiv.innerHTML = marked.parse(botResponse);
          enhanceMessage(botMessageDiv);
          if (shouldAutoScroll()) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }

        enhanceMessage(botMessageDiv);
        appendCopyButton(botMessageDiv, botResponse, false);
        chat.messages.push({
          content: botResponse,
          isUser: false,
          timestamp: Date.now(),
          fuentesData: data.results || []
        });
        saveChatsToStorage();

        let fuentesData = data.results || [];

        const fuentesBtn = document.createElement('button');
        fuentesBtn.textContent = 'Fuentes';
        fuentesBtn.classList.add('fuentes-btn');
        botMessageDiv.appendChild(fuentesBtn);

        let fuentesSidebar = document.getElementById('fuentesSidebar');
        if (!fuentesSidebar) {
          fuentesSidebar = document.createElement('div');
          fuentesSidebar.id = 'fuentesSidebar';
          fuentesSidebar.classList.add('fuentes-sidebar');
          fuentesSidebar.innerHTML = `
            <button id="fuentesCloseBtn" class="fuentes-close-btn">X</button>
            <h3>Fuentes Consultadas</h3>
            <ul id="fuentesList"></ul>
          `;
          document.body.appendChild(fuentesSidebar);
        }

        fuentesBtn.addEventListener('click', () => {
          const fuentesList = document.getElementById('fuentesList');
          fuentesList.innerHTML = '';
          const topFuentes = fuentesData.slice(0, 10);
          topFuentes.forEach((result, index) => {
            let snippet = result.snippet;
            if (snippet && snippet.length > 150) {
              snippet = snippet.substring(0, 150) + '...';
            }
            const li = document.createElement('li');
            li.style.marginBottom = '10px';
            li.innerHTML = `<strong>${index + 1}.</strong> <a href="${result.url}" target="_blank">${result.title}</a><br><small>${snippet || ''}</small>`;
            fuentesList.appendChild(li);
          });
          fuentesSidebar.classList.add('open');
        });

        document.getElementById('fuentesCloseBtn').addEventListener('click', () => {
          fuentesSidebar.classList.remove('open');
        });
      } catch (error) {
        console.error('Error en la búsqueda o en el procesamiento:', error);
        displayMessage('Error al realizar la búsqueda o procesar la respuesta.', false);
      } finally {
        clearInterval(countdownInterval);
        loadingDiv.remove();
        sendBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        `;
        sendBtn.style.backgroundColor = '#ffffff';
        sendBtn.onclick = sendMessage;
      }
      return;
    }

    chat.messages.push({
      content: apiMessageContent,
      displayContent: displayMessageContent,
      isUser: true,
      files: fileNames,
      timestamp: Date.now()
    });
    touchCurrentChat();      
  saveChatsToStorage();
    userInput.value = '';
    document.querySelectorAll('.file-preview').forEach((p) => p.remove());
    displayMessage(displayMessageContent, true);
    autoResizeTextarea();

    const { loadingDiv, countdownInterval } = showLoadingWithCounter();

    abortController = new AbortController();
    sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
    sendBtn.style.backgroundColor = '#FF0000E6';
    sendBtn.onclick = cancelRequest;

    try {
      const conversationMessages = chat.messages.map((msg) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      }));
      const response = await fetch('https://arex-backend.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          chatHeaderTitle: document.getElementById('chatHeaderTitle').textContent
        }),
        signal: abortController.signal
      });

      const botMessageDiv = document.createElement('div');
      botMessageDiv.className = 'message bot-message';
      chatMessages.appendChild(botMessageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (!line) continue;
          if (line.startsWith('data:')) {
            let jsonStr = line.replace(/^(data:\s*)+/i, '');
            if (jsonStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              if (
                parsed.choices &&
                parsed.choices.length > 0 &&
                parsed.choices[0].delta
              ) {
                const delta = parsed.choices[0].delta;
                if (delta.reasoning_content) {
                  if (!window.reasoningContainer) {
                    const reasoningDiv = document.createElement('div');
                    reasoningDiv.className = 'message bot-message reasoning-message';
                    reasoningDiv.innerHTML = `<strong>Pensamiento:</strong><br><span class="reasoning-text"></span>`;
                    chatMessages.insertBefore(reasoningDiv, botMessageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    window.reasoningContainer = reasoningDiv.querySelector('.reasoning-text');
                  }
                  window.reasoningContainer.innerHTML += delta.reasoning_content;
                }
                if (delta.content) {
                  botResponse += delta.content;
                }
              }
            } catch (error) {
              console.error("Error al parsear JSON:", error);
            }
          }
        }
        botMessageDiv.innerHTML = marked.parse(botResponse);
        enhanceMessage(botMessageDiv);
        if (shouldAutoScroll()) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }

      enhanceMessage(botMessageDiv);
      appendCopyButton(botMessageDiv, botResponse, false);
      
      chat.messages.push({
        content: botResponse,
        isUser: false,
        timestamp: Date.now(),
        fuentesData: []
      });
      touchCurrentChat();
      saveChatsToStorage();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Solicitud cancelada por el usuario.');
        displayMessage('Solicitud cancelada.', false);
      } else {
        console.error('Error al enviar el mensaje:', error);
        displayMessage('Error: No se pudo conectar con el servidor.', false);
      }
    } finally {
      sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      `;
      sendBtn.style.backgroundColor = '#ffffff';
      sendBtn.onclick = sendMessage;
      clearInterval(countdownInterval);
      loadingDiv.remove();
      document.querySelectorAll('.file-preview').forEach((p) => p.remove());
    }
  };

  // Reenviar mensaje luego de editarlo
  async function resendAfterEdit() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    const { loadingDiv, countdownInterval } = showLoadingWithCounter();
    abortController = new AbortController();
    sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 18L18 6M6 6l12 12"/>
      </svg>`;
    sendBtn.style.backgroundColor = '#FF0000E6';
    sendBtn.onclick = cancelRequest;

    try {
      const conversationMessages = chat.messages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      }));

      const response = await fetch('https://arex-backend.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          chatHeaderTitle: document.getElementById('chatHeaderTitle').textContent
        }),
        signal: abortController.signal
      });

      const botMessageDiv = document.createElement('div');
      botMessageDiv.className = 'message bot-message';
      chatMessages.appendChild(botMessageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (let line of chunk.split('\n')) {
          line = line.trim();
          if (!line) continue;
          if (line.startsWith('data:')) {
            const jsonStr = line.replace(/^(data:\s*)+/i, '');
            if (jsonStr === '[DONE]') { break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta || {};
              if (delta.reasoning_content) {
                if (!window.reasoningContainer) {
                  const reasoningDiv = document.createElement('div');
                  reasoningDiv.className = 'message bot-message reasoning-message';
                  reasoningDiv.innerHTML = `<strong>Pensamiento:</strong><br><span class="reasoning-text"></span>`;
                  chatMessages.insertBefore(reasoningDiv, botMessageDiv);
                  window.reasoningContainer = reasoningDiv.querySelector('.reasoning-text');
                }
                window.reasoningContainer.innerHTML += delta.reasoning_content;
              }
              if (delta.content) botResponse += delta.content;
            } catch { /* ignoramos parseos fallidos */ }
          }
        }
        botMessageDiv.innerHTML = marked.parse(botResponse);
        enhanceMessage(botMessageDiv);
        if (shouldAutoScroll()) chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      enhanceMessage(botMessageDiv);
      appendCopyButton(botMessageDiv, botResponse, false);

      chat.messages.push({
        content: botResponse,
        isUser: false,
        timestamp: Date.now(),
        fuentesData: []
      });

      saveChatsToStorage();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al reenviar tras edición:', err);
        displayMessage('Error: no se pudo obtener la nueva respuesta.', false);
      }
    } finally {
      sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>`;
      sendBtn.style.backgroundColor = '#ffffff';
      sendBtn.onclick = sendMessage;
      clearInterval(countdownInterval);
      loadingDiv.remove();
    }
  }

  // CANCELAR SOLICITUD A LA API
  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  // AUTO-SCROLLING
  function shouldAutoScroll() {
    return chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
  }

  // FUNCIÓN PARA OBTENER EL ÍCONO SEGÚN LA EXTENSIÓN DEL ARCHIVO
  function getFileIcon(extension) {
    extension = extension.toLowerCase();
    if (extension === 'xls' || extension === 'xlsx') {
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
      `;
    } else if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') {
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      `;
    } else {
      return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      `;
    }
  }

  // MOSTRAR MENSAJE EN EL CHAT
  const displayMessage = (content, isUser, options = {}) => {
    const rawContent = content;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    if (isUser) {
      const formattedContent = content
        .replace(/\n/g, '<br>')
        .replace(/\[(.*?)\]/g, (match, fileName) => {
          const fileExtension = fileName.split('.').pop().toUpperCase();
          const fileSize = '';
          return `
            <div class="file-tag">
              <div class="file-icon">
                ${getFileIcon(fileExtension)}
              </div>
              <div class="file-details">
                <div class="file-name">${fileName}</div>
                <div class="file-meta">
                  <span class="file-type">${fileExtension}</span>
                  <span class="file-size">${fileSize}</span>
                </div>
              </div>
            </div>
          `;
        });
      messageDiv.innerHTML = formattedContent;
    } else {
      if (content.includes('<div class="search-results">')) {
        messageDiv.innerHTML = content;
      } else {
        content = content.replace(/\\\[(.+?)\\\]/gs, (match, p1) => `$$${p1.trim()}$$`);
        content = content.replace(/\$\$(.*?)\$\$/g, (match, inner) => {
          return inner.includes('\n') ? match : `$$\n${inner}\n$$`;
        });
        let processedContent = marked.parse(content);
        processedContent = processedContent
          .replace(/\\\(.+?\\\)/g, (match) => match)
          .replace(/\\\[.+?\\\]/g, (match) => match)
          .replace(/\\boxed\{(.+?)\}/g, (match) => `\\boxed{${match.slice(7, -1)}}`);
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = processedContent;
        const codeBlocks = tempContainer.querySelectorAll('pre > code');
        codeBlocks.forEach((codeBlock) => {
          const language = codeBlock.className.replace('language-', '') || 'plaintext';
          const header = document.createElement('div');
          header.classList.add('code-header');
          const languageSpan = document.createElement('span');
          languageSpan.textContent = language;
          const copyIcon = document.createElement('button');
          copyIcon.classList.add('copy-icon');
          copyIcon.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          `;
          copyIcon.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent)
              .then(() => {
                copyIcon.innerHTML = `
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                `;
                setTimeout(() => {
                  copyIcon.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                  `;
                }, 2000);
              })
              .catch((err) => console.error('Error al copiar el código:', err));
          });
          header.appendChild(languageSpan);
          header.appendChild(copyIcon);
          const preBlock = codeBlock.parentElement;
          preBlock.parentElement.insertBefore(header, preBlock);
          preBlock.classList.add('line-numbers');
          preBlock.setAttribute('data-lang', language);
          Prism.highlightElement(codeBlock);
        });
        while (tempContainer.firstChild) {
          messageDiv.appendChild(tempContainer.firstChild);
        }
      }
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    enhanceMessage(messageDiv);

    if (!isUser && options.fuentesData && options.fuentesData.length > 0) {
      const fuentesBtn = document.createElement('button');
      fuentesBtn.textContent = 'Fuentes';
      fuentesBtn.classList.add('fuentes-btn');
      messageDiv.appendChild(fuentesBtn);

      fuentesBtn.addEventListener('click', () => {
        let fuentesSidebar = document.getElementById('fuentesSidebar');
        if (!fuentesSidebar) {
          fuentesSidebar = document.createElement('div');
          fuentesSidebar.id = 'fuentesSidebar';
          fuentesSidebar.classList.add('fuentes-sidebar');
          fuentesSidebar.innerHTML = `
            <button id="fuentesCloseBtn" class="fuentes-close-btn">X</button>
            <h3>Fuentes Consultadas</h3>
            <ul id="fuentesList"></ul>
          `;
          document.body.appendChild(fuentesSidebar);
        }
        const fuentesList = document.getElementById('fuentesList');
        fuentesList.innerHTML = '';
        const topFuentes = options.fuentesData.slice(0, 10);
        topFuentes.forEach((result, index) => {
          let snippet = result.snippet;
          if (snippet && snippet.length > 150) {
            snippet = snippet.substring(0, 150) + '...';
          }
          const li = document.createElement('li');
          li.style.marginBottom = '10px';
          li.innerHTML = `<strong>${index + 1}.</strong> <a href="${result.url}" target="_blank">${result.title}</a><br><small>${snippet || ''}</small>`;
          fuentesList.appendChild(li);
        });
        fuentesSidebar.classList.add('open');
        document.getElementById('fuentesCloseBtn').addEventListener('click', () => {
          fuentesSidebar.classList.remove('open');
        });
      });
    }

    const copyButtonContainer = document.createElement('div');
    copyButtonContainer.style.display = 'flex';
    copyButtonContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';
    copyButtonContainer.style.marginTop = '5px';
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.style.padding = '5px';
    copyButton.style.backgroundColor = 'transparent';
    copyButton.style.border = 'none';
    copyButton.style.cursor = 'pointer';
    copyButton.style.display = 'flex';
    copyButton.style.alignItems = 'center';
    copyButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
    `;
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(content)
        .then(() => {
          copyButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          setTimeout(() => {
            copyButton.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            `;
          }, 2000);
        })
        .catch((err) => console.error('Error al copiar el texto:', err));
    });
    copyButtonContainer.appendChild(copyButton);

    if (!isUser && content !== "¡Hola! Soy Arex, el asistente de IA de Anuvyx.\n\n¿En qué puedo ayudarte hoy?\n") {
      const reloadButton = document.createElement('button');
      reloadButton.className = 'reload-button';
      reloadButton.style.padding = '5px';
      reloadButton.style.backgroundColor = 'transparent';
      reloadButton.style.border = 'none';
      reloadButton.style.cursor = 'pointer';
      reloadButton.style.display = 'flex';
      reloadButton.style.alignItems = 'center';
      reloadButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
          <path d="M20.49 15A9 9 0 0 1 5.85 18.36L1 14"></path>
        </svg>
      `;

      reloadButton.addEventListener('click', () => {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;
        const lastBotIndex = [...chat.messages].reverse().findIndex(m => !m.isUser && m.content === rawContent);
        if (lastBotIndex !== -1) {
          const trueIndex = chat.messages.length - 1 - lastBotIndex;
          chat.messages = chat.messages.slice(0, trueIndex);
          saveChatsToStorage();
          loadChatMessages();
          resendAfterEdit();
        }
      });

      copyButtonContainer.appendChild(reloadButton);
    }

    chatMessages.appendChild(copyButtonContainer);

    if (isUser) {
      const editButton = document.createElement('button');
      editButton.className = 'edit-button';
      editButton.style.padding = '5px';
      editButton.style.backgroundColor = 'transparent';
      editButton.style.border = 'none';
      editButton.style.cursor = 'pointer';
      editButton.style.display = 'flex';
      editButton.style.alignItems = 'center';

      editButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
        </svg>
      `;
      editButton.addEventListener('click', async () => {
        const newText = await showCustomPrompt("Editar mensaje:", content);
        if (newText !== null && newText.trim()) {
          const chat = chats.find(c => c.id === currentChatId);
          const userIndex = chat.messages.findIndex(m => m.content === content && m.isUser);

          if (userIndex !== -1) {
            chat.messages[userIndex].content = newText.trim();
            chat.messages[userIndex].displayContent = newText.trim();

            chat.messages = chat.messages.slice(0, userIndex + 1);

            saveChatsToStorage();

            loadChatMessages();

            resendAfterEdit();
          }
        }
      });
      copyButtonContainer.appendChild(editButton);
    }

    chatMessages.appendChild(copyButtonContainer);
  };

  // AJUSTE DINÁMICO DEL TEXTAREA
  const autoResizeTextarea = () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${userInput.scrollHeight}px`;
  };

  // VISIBILIDAD DEL SIDEBAR
  const toggleSidebar = () => {
    chatSidebar.classList.toggle('hidden');
    const isHidden = chatSidebar.classList.contains('hidden');
    localStorage.setItem('sidebarState', isHidden ? 'hidden' : 'visible');
  };

  // INICIALIZACIÓN Y EVENT LISTENERS
  const init = () => {
    purgeOldChats();
    if (localStorage.getItem('isLoggedIn') === 'true') {
      const loginLink  = document.querySelector('.login-link');   
      if (loginLink) {
        const loginSection = loginLink.parentElement;            
        loginLink.remove();    
        
        loginSection.classList.add('with-user'); 
    
        const userMenuContainer = document.createElement('div');
        userMenuContainer.classList.add('user-menu-container');
    
        const userIconLink = document.createElement('div');
        userIconLink.classList.add('user-icon-container');
    
        const userIconImg = document.createElement('img');
        userIconImg.src  = '../static/icons/user-icon-black.png';
        userIconImg.alt  = 'Perfil';
        userIconImg.classList.add('user-icon');
    
        const dropupMenu = document.createElement('div');
        dropupMenu.classList.add('user-dropup');
        dropupMenu.innerHTML = `
          <a href="../account/profile.html" class="dropup-item">Perfil</a>
          <div class="dropup-item logout-button">Cerrar Sesión</div>
        `;
    
        userIconLink.appendChild(userIconImg);
        userMenuContainer.appendChild(userIconLink);
        userMenuContainer.appendChild(dropupMenu);
        loginSection.appendChild(userMenuContainer);
    
        userIconLink.addEventListener('click', (e) => {
          e.stopPropagation();
          dropupMenu.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
          if (!userMenuContainer.contains(e.target)) dropupMenu.classList.remove('show');
        });

        dropupMenu.querySelector('.logout-button').addEventListener('click', () => {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('authToken');
          localStorage.removeItem('selectedChatId');
          localStorage.removeItem('arexChats'); // <-- elimina chats del usuario

          window.location.reload();
        });
      }
    }
    
    newChatBtn.addEventListener('click', createNewChat);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    deleteChatsBtn.addEventListener('click', async () => {
      const confirmDelete = await showCustomDelete('¿Estás seguro de que quieres eliminar todos los chats?');
      if (confirmDelete) {
        chats = [];
        localStorage.removeItem('arexChats');
        chatHistory.innerHTML = '';
        chatMessages.innerHTML = '';

        if (localStorage.getItem('isLoggedIn') === 'true') {
          const token = localStorage.getItem('authToken');
          await fetch('https://arex-backend.vercel.app/api/chats', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }).catch(err => console.error('Error al eliminar todos los chats del servidor:', err));
        }

        await showCustomAlert('Todos los chats han sido eliminados.');
      }
    });
   
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('floatingToggle').addEventListener('click', toggleSidebar);
    userInput.addEventListener('input', autoResizeTextarea);
    autoResizeTextarea();

    window.addEventListener('load', async () => {
      const sidebarState = localStorage.getItem('sidebarState');
      if (sidebarState === 'hidden' && window.innerWidth >= 769) {
        chatSidebar.classList.add('hidden');
      }

      if (localStorage.getItem('isLoggedIn') === 'true') {
        chats = await fetchChatsFromServer();
      } else {
        chats = JSON.parse(localStorage.getItem('arexChats')) || [];
      }

      const savedChatId = localStorage.getItem('selectedChatId');
      if (savedChatId && chats.some((chat) => chat.id === savedChatId)) {
        currentChatId = savedChatId;
      } else if (chats.length > 0) {
        currentChatId = chats[0].id;
      } else {
        createNewChat();
      }

      if (!chats.some(c => c.id === currentChatId)) {
        currentChatId = chats.length ? chats[0].id : null;
      }

      loadChatHistory();
      loadChatMessages();
    });

    document.getElementById('file-upload').addEventListener('change', handleFileUpload);

    userInput.addEventListener('paste', (event) => {
      if (event.clipboardData && event.clipboardData.items) {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (!file) continue;
            const extension = file.name.split('.').pop().toLowerCase();
            if (['txt', 'csv', 'tsv', 'json', 'xml'].includes(extension)) {
              const reader = new FileReader();
              reader.onload = function (e) {
                let content = e.target.result;
                if (extension === 'json') {
                  try {
                    const parsed = JSON.parse(content);
                    content = JSON.stringify(parsed, null, 2);
                  } catch (error) {
                    console.error("Error al parsear JSON:", error);
                  }
                }
                displayFilePreview(file, content);
              };
              reader.readAsText(file);
            } else if (extension === 'docx') {
              const reader = new FileReader();
              reader.onload = function (e) {
                const arrayBuffer = e.target.result;
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                  .then((result) => {
                    const content = result.value;
                    displayFilePreview(file, content);
                  })
                  .catch((error) => {
                    console.error("Error al procesar DOCX:", error);
                  });
              };
              reader.readAsArrayBuffer(file);
            } else if (['xlsx', 'xls'].includes(extension)) {
              const reader = new FileReader();
              reader.onload = function (e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                let content = '';
                workbook.SheetNames.forEach((sheetName) => {
                  const worksheet = workbook.Sheets[sheetName];
                  const csv = XLSX.utils.sheet_to_csv(worksheet);
                  content += `--- ${sheetName} ---\n${csv}\n\n`;
                });
                displayFilePreview(file, content);
              };
              reader.readAsArrayBuffer(file);
            } else if (extension === 'pdf') {
              const reader = new FileReader();
              reader.onload = function (e) {
                const typedarray = new Uint8Array(e.target.result);
                pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
                  let maxPages = pdf.numPages;
                  let countPromises = [];
                  for (let i = 1; i <= maxPages; i++) {
                    countPromises.push(
                      pdf.getPage(i).then((page) => {
                        return page.getTextContent().then((textContent) => {
                          return textContent.items.map((item) => item.str).join(' ');
                        });
                      })
                    );
                  }
                  Promise.all(countPromises).then((texts) => {
                    const content = texts.join('\n\n');
                    displayFilePreview(file, content);
                  });
                }).catch((error) => {
                  console.error("Error al procesar PDF:", error);
                });
              };
              reader.readAsArrayBuffer(file);
            } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
              if (document.getElementById('chatHeaderTitle').textContent.trim() === "AREX") {
                showCustomAlert("No es posible subir imágenes en esta versión. Intenta de nuevo en la versión Gold o Deluxe.");
                continue;
              }              
              const reader = new FileReader();
              reader.onload = function (e) {
                const imageDataUrl = e.target.result;
                Tesseract.recognize(imageDataUrl, 'spa', { logger: (m) => console.log(m) })
                  .then(({ data: { text } }) => {
                    Vibrant.from(imageDataUrl).getPalette()
                      .then((palette) => {
                        const textColor = palette.Vibrant ? palette.Vibrant.getHex() : '#FFFFFF';
                        const bgColor = palette.DarkMuted ? palette.DarkMuted.getHex() : '#000000';
                        const resultText = `Texto extraído: ${text.trim()}\nColor de texto: ${textColor}\nColor de fondo: ${bgColor}`;
                        displayFilePreview(file, resultText);
                      })
                      .catch((err) => {
                        console.error("Error al extraer colores:", err);
                        displayFilePreview(file, `Texto extraído: ${text.trim()}`);
                      });
                  })
                  .catch((error) => {
                    console.error("Error al procesar imagen:", error);
                  });
              };
              reader.readAsDataURL(file);
            }
          }
        }
      }
    });

    // MANEJO DE ARCHIVOS
    async function handleFileUpload(event) {
      const files = event.target.files;
      if (!files.length) return;
      searchWebBtn.disabled = true;
      searchWebBtn.classList.add('disabled');
      let totalSize = 0;
      let filePreviewsContainer = document.querySelector('.file-previews-container');
      if (filePreviewsContainer) {
        const previews = filePreviewsContainer.querySelectorAll('.file-preview');
        previews.forEach((preview) => {
          totalSize += parseInt(preview.dataset.filesize) || 0;
        });
      }
      for (const file of files) {
        if (totalSize + file.size > 20 * 1024 * 1024) {
          await showCustomAlert(`No se puede subir el archivo "${file.name}" porque el tamaño total excede 20MB.`);
          continue;
        }        
        totalSize += file.size;
        const extension = file.name.split('.').pop().toLowerCase();
        if (['txt', 'csv', 'tsv', 'json', 'xml'].includes(extension)) {
          const reader = new FileReader();
          reader.onload = function (e) {
            let content = e.target.result;
            if (extension === 'json') {
              try {
                const parsed = JSON.parse(content);
                content = JSON.stringify(parsed, null, 2);
              } catch (error) {
                console.error("Error al parsear JSON:", error);
              }
            }
            displayFilePreview(file, content);
          };
          reader.readAsText(file);
        } else if (extension === 'docx') {
          const reader = new FileReader();
          reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
              .then((result) => {
                const content = result.value;
                displayFilePreview(file, content);
              })
              .catch((error) => {
                console.error("Error al procesar DOCX:", error);
              });
          };
          reader.readAsArrayBuffer(file);
        } else if (extension === 'xlsx' || extension === 'xls') {
          const reader = new FileReader();
          reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let content = '';
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(worksheet);
              content += `--- ${sheetName} ---\n${csv}\n\n`;
            });
            displayFilePreview(file, content);
          };
          reader.readAsArrayBuffer(file);
        } else if (extension === 'pdf') {
          const reader = new FileReader();
          reader.onload = function (e) {
            const typedarray = new Uint8Array(e.target.result);
            pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
              let maxPages = pdf.numPages;
              let countPromises = [];
              for (let i = 1; i <= maxPages; i++) {
                countPromises.push(
                  pdf.getPage(i).then((page) => {
                    return page.getTextContent().then((textContent) => {
                      return textContent.items.map((item) => item.str).join(' ');
                    });
                  })
                );
              }
              Promise.all(countPromises).then((texts) => {
                const content = texts.join('\n\n');
                displayFilePreview(file, content);
              });
            }).catch((error) => {
              console.error("Error al procesar PDF:", error);
            });
          };
          reader.readAsArrayBuffer(file);
        } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
          if (document.getElementById('chatHeaderTitle').textContent.trim() === "AREX") {
            showCustomAlert("No es posible subir imágenes en esta versión. Intenta de nuevo en la versión Gold o Deluxe.");
            continue;
          }          
          const reader = new FileReader();
          reader.onload = function (e) {
            const imageDataUrl = e.target.result;
            Tesseract.recognize(imageDataUrl, 'spa', { logger: (m) => console.log(m) })
              .then(({ data: { text } }) => {
                Vibrant.from(imageDataUrl).getPalette()
                  .then((palette) => {
                    const textColor = palette.Vibrant ? palette.Vibrant.getHex() : '#FFFFFF';
                    const bgColor = palette.DarkMuted ? palette.DarkMuted.getHex() : '#000000';
                    const resultText = `Texto extraído: ${text.trim()}\nColor de texto: ${textColor}\nColor de fondo: ${bgColor}`;
                    displayFilePreview(file, resultText);
                  })
                  .catch((err) => {
                    console.error("Error al extraer colores:", err);
                    displayFilePreview(file, `Texto extraído: ${text.trim()}`);
                  });
              })
              .catch((error) => {
                console.error("Error al procesar imagen:", error);
              });
          };
          reader.readAsDataURL(file);        
        }
      }
    }

    function displayFilePreview(file, content) {
      const fileExtension = file.name.split('.').pop();
      const iconHTML = getFileIcon(fileExtension);
      const preview = document.createElement('div');
      preview.className = 'file-preview';
      preview.dataset.filename = file.name;
      preview.dataset.content = content;
      preview.dataset.filesize = file.size;
      preview.innerHTML = `
        <div class="file-icon">
          ${iconHTML}
        </div>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            <span class="file-type">${fileExtension.toUpperCase()}</span>
            <span class="file-size">${formatBytes(file.size)}</span>
          </div>
        </div>
        <button class="remove-file">×</button>
      `;
      
      preview.querySelector('.remove-file').addEventListener('click', () => {
        preview.remove();
        if (document.querySelectorAll('.file-preview').length === 0) {
          searchWebBtn.disabled = false;
          searchWebBtn.classList.remove('disabled');
        }
      });

      let filePreviewsContainer = document.querySelector('.file-previews-container');
      if (!filePreviewsContainer) {
        filePreviewsContainer = document.createElement('div');
        filePreviewsContainer.className = 'file-previews-container';
        const chatInput = document.querySelector('.chat-input');
        chatInput.insertBefore(filePreviewsContainer, chatInput.firstChild);
      }
      filePreviewsContainer.appendChild(preview);
    }
    
    function formatBytes(bytes) {
      const units = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      for (; bytes >= 1024 && i < units.length - 1; i++) {
        bytes /= 1024;
      }
      return `${bytes.toFixed(1)} ${units[i]}`;
    }

    function removeDiacritics(str) {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    const chatSearchInput = document.getElementById('chatSearchInput');
    chatSearchInput.addEventListener('input', () => {
      const query = removeDiacritics(chatSearchInput.value.toLowerCase());
      const chatItems = chatHistory.querySelectorAll('.chat-item');
      chatItems.forEach((item) => {
        const chatName = removeDiacritics(item.querySelector('.chat-info span').textContent.toLowerCase());
        item.style.display = chatName.includes(query) ? '' : 'none';
      });
    });
  };

  init();
})();