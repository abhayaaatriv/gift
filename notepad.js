(function () {
  window.notepadContent = window.notepadContent || '';

  function injectNotepadUI() {
    if (document.getElementById('notepad-overlay')) return;

    const style = document.createElement('style');
    style.id = 'notepad-styles';
    style.textContent = `
      #notepad-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 5000;
        display: none;
        align-items: center;
        justify-content: center;
      }

      #notepad-window {
        background: #fff;
        border: 2px solid #000;
        box-shadow: 4px 4px 0 #000;
        width: clamp(320px, 55vw, 620px);
        display: flex;
        flex-direction: column;
      }

      #notepad-titlebar {
        background: linear-gradient(180deg, #1a6fe8 0%, #0055CC 100%);
        color: #fff;
        border-bottom: 2px solid #000;
        padding: 4px 7px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
      }

      #notepad-title-left {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      #notepad-title-icon {
        width: 16px;
        height: 16px;
        object-fit: cover;
        object-position: center;
        image-rendering: auto;
        flex-shrink: 0;
      }

      #notepad-title-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 6.5px;
        letter-spacing: 0.04em;
        text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #notepad-controls {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
      }

      .notepad-ctl {
        width: 14px;
        height: 14px;
        border: 2px solid #000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7px;
        font-weight: 900;
        font-family: 'Press Start 2P', monospace;
        cursor: pointer;
        line-height: 1;
        padding: 0;
      }

      .notepad-ctl.min { background: #FFE600; color: #000; }
      .notepad-ctl.max { background: #3CB043; color: #000; }
      .notepad-ctl.close { background: #E8212C; color: #fff; }

      #notepad-menubar {
        background: #d4d0c8;
        border-bottom: 1px solid #808080;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 5px 8px;
        font-family: 'Press Start 2P', monospace;
        font-size: 6px;
        color: #000;
      }

      #notepad-textarea {
        width: 100%;
        min-height: 320px;
        border: none;
        outline: none;
        resize: vertical;
        padding: 12px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.45;
        background: #fff;
        color: #000;
        user-select: text;
        cursor: text;
      }

      #notepad-status {
        background: #d4d0c8;
        border-top: 1px solid #808080;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      #notepad-status-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 5.5px;
        color: #000;
      }

      #notepad-analyze {
        font-family: 'Press Start 2P', monospace;
        font-size: 6px;
        padding: 5px 9px;
        background: #0055CC;
        color: #fff;
        border: 2px solid #000;
        box-shadow: 2px 2px 0 #000;
        cursor: pointer;
      }

      #notepad-analyze:active {
        transform: translate(1px, 1px);
        box-shadow: 0 0 0;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'notepad-overlay';
    overlay.innerHTML = `
      <div id="notepad-window" role="dialog" aria-label="Notepad">
        <div id="notepad-titlebar">
          <div id="notepad-title-left">
            <img id="notepad-title-icon" src="notepad-icon.png" alt="notepad icon">
            <span id="notepad-title-text">Untitled - Notepad</span>
          </div>
          <div id="notepad-controls">
            <button type="button" class="notepad-ctl min" aria-label="Minimize">_</button>
            <button type="button" class="notepad-ctl max" aria-label="Maximize">□</button>
            <button type="button" class="notepad-ctl close" id="notepad-close" aria-label="Close">✕</button>
          </div>
        </div>
        <div id="notepad-menubar">
          <span>File</span>
          <span>Edit</span>
          <span>Format</span>
          <span>View</span>
          <span>Help</span>
        </div>
        <textarea id="notepad-textarea" placeholder="Write anything about the person you're gifting...

Things they love, things they hate, recent obsessions, their vibe — 
anything helps the AI give better gift suggestions."></textarea>
        <div id="notepad-status">
          <span id="notepad-status-text">Ln 1, Col 1  |  100%  |  Windows (CRLF)  |  UTF-8</span>
          <button type="button" id="notepad-analyze">✨ ANALYZE NOTES →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('notepad-close');
    const analyzeBtn = document.getElementById('notepad-analyze');

    closeBtn?.addEventListener('click', window.closeNotepad);
    analyzeBtn?.addEventListener('click', window.analyzeNotepad);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        window.closeNotepad();
      }
    });
  }

  window.openNotepad = function () {
    const overlay = document.getElementById('notepad-overlay');
    const noteWindow = document.getElementById('notepad-window');
    const titlebar = document.getElementById('notepad-titlebar');
    const textarea = document.getElementById('notepad-textarea');

    if (!overlay || !noteWindow || !titlebar || !textarea) return;

    overlay.style.display = 'flex';
    textarea.value = window.notepadContent || '';
    textarea.focus();
    makeDraggable(noteWindow, titlebar);
  };

  window.closeNotepad = function () {
    const overlay = document.getElementById('notepad-overlay');
    const textarea = document.getElementById('notepad-textarea');
    if (textarea) {
      window.notepadContent = textarea.value;
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
  };

  function makeDraggable(windowEl, handleEl) {
    if (!windowEl || !handleEl || windowEl.dataset.dragBound === 'true') return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function onMouseMove(event) {
      if (!dragging) return;
      const nextLeft = startLeft + (event.clientX - startX);
      const nextTop = startTop + (event.clientY - startY);
      windowEl.style.left = nextLeft + 'px';
      windowEl.style.top = nextTop + 'px';
    }

    function onMouseUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    handleEl.addEventListener('mousedown', function (event) {
      if (event.button !== 0) return;
      if (event.target.closest('#notepad-controls')) return;

      const rect = windowEl.getBoundingClientRect();
      windowEl.style.position = 'absolute';
      windowEl.style.left = rect.left + 'px';
      windowEl.style.top = rect.top + 'px';

      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      dragging = true;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    windowEl.dataset.dragBound = 'true';
  }

  window.analyzeNotepad = function () {
    const textarea = document.getElementById('notepad-textarea');
    const text = textarea ? textarea.value : '';
    window.notepadContent = text;

    if (!window.notepadContent.trim()) {
      alert('Write something about the person first!');
      return;
    }

    if (typeof window.profileData === 'object' && window.profileData) {
      window.profileData.notepad = {
        analysis: 'Personal notes: ' + window.notepadContent
      };

      const statProfiles = document.getElementById('stat-profiles');
      if (statProfiles) {
        statProfiles.textContent = Object.keys(window.profileData).length;
      }
    }

    window.closeNotepad();

    if (typeof window.goPage === 'function') {
      window.goPage('discover');
    }

    if (typeof window.refreshGifts === 'function') {
      setTimeout(function () {
        window.refreshGifts();
      }, 300);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNotepadUI);
  } else {
    injectNotepadUI();
  }
})();