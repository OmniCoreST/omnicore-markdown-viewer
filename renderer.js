// ============================================
// IMPORTS
// ============================================
const { ipcRenderer, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const html2canvas = require('html2canvas');

// Helper modules
const { removeBOM, getFileName, getDirectory, escapeRegex, formatBytes } = require('./utils');
const { getMermaidConfig } = require('./mermaid-config');
const OmniWare = require('./omniwire/omniware');
const { getOmniWareDarkCSS } = require('./omniware-config');
const { positionContextMenu, hideContextMenu: hideContextMenuHelper } = require('./context-menu-utils');

// Libraries loaded from CDN in index.html
// marked, mermaid, and DOMPurify are available globally

// ============================================
// INITIALIZATION
// ============================================

function initializeMermaidWithTheme() {
  const isDark = localStorage.getItem('darkMode') === 'enabled';
  mermaid.initialize(getMermaidConfig(isDark));
}

// Initial mermaid setup
initializeMermaidWithTheme();

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
  sanitize: false
});

// ============================================
// CONFIGURATION CONSTANTS
// ============================================
const ZOOM_CONFIG = {
  level: 100,
  step: 10,
  min: 50,
  max: 200
};

// ============================================
// LOCALIZATION
// ============================================
let interfaceLang = localStorage.getItem('interfaceLang') || 'en';

const UI_STRINGS = {
  en: {
    'open': 'Open', 'edit': 'Edit', 'pdf': 'PDF', 'word': 'Word',
    'file': 'File', 'title.file': 'File',
    'openFile': 'Open File', 'export': 'Export',
    'exportPdf': 'Export as PDF', 'exportWord': 'Export as Word',
    'history': 'History', 'editMode': 'Edit Mode',
    'allNotes': 'All Notes', 'noNotes': 'No notes found',
    'view': 'View', 'title.view': 'View',
    'tools': 'Tools', 'darkMode': 'Dark Mode', 'corporateMode': 'Corporate Mode', 'fullscreen': 'Fullscreen', 'showNotes': 'Show Notes',
    'corporateModeEnabled': 'Corporate letterhead enabled', 'corporateModeDisabled': 'Corporate letterhead disabled',
    'save': 'Save', 'reload': 'Reload', 'dismiss': 'Dismiss',
    'cancel': 'Cancel', 'find': 'Find', 'later': 'Later', 'exit': 'Exit',
    'title.open': 'Open File (Ctrl+O)', 'title.recent': 'Recent Files',
    'title.toc': 'Table of Contents', 'title.edit': 'Toggle Edit Mode',
    'title.exitEdit': 'Exit Edit Mode',
    'title.pdf': 'Export to PDF', 'title.word': 'Export to Word',
    'title.zoomOut': 'Zoom Out (Ctrl+-)', 'title.zoomReset': 'Reset Zoom (Ctrl+0)',
    'title.zoomIn': 'Zoom In (Ctrl++)', 'title.darkMode': 'Toggle Dark Mode',
    'title.tools': 'Tools', 'title.fullscreen': 'Toggle Fullscreen (F11)',
    'title.back': 'Back (Left Arrow)', 'title.forward': 'Forward (Right Arrow)',
    'title.refresh': 'Refresh Document (Ctrl+R)', 'title.save': 'Save (Ctrl+S)',
    'title.clearRecent': 'Clear All Recent Files',
    'title.searchPrev': 'Previous (Shift+Enter)', 'title.searchNext': 'Next (Enter)',
    'title.searchClose': 'Close (Esc)', 'title.removeRecent': 'Remove from recent files',
    'title.note': 'Title',
    'recentFiles': 'Recent Files', 'tableOfContents': 'Table of Contents',
    'rawMarkdown': 'Raw Markdown', 'loading': 'Loading...',
    'searchPlaceholder': 'Search in document...', 'noRecentFiles': 'No recent files',
    'noHeaders': 'No headers found', 'unsaved': '● Unsaved',
    'editorPlaceholder': 'Start typing markdown...',
    'welcome.title': 'Welcome to Omnicore Markdown Viewer',
    'welcome.subtitle': 'Press Ctrl+O to open a markdown file',
    'welcome.features': 'Features',
    'fileUpdated': 'File Updated',
    'fileModifiedExternally': 'This file has been modified externally',
    'updateAvailable': 'Update Available', 'newVersionAvailable': 'A new version is available',
    'downloadUpdate': 'Download Update', 'restartInstall': 'Restart & Install',
    'ctx.copy': 'Copy', 'ctx.copyPlain': 'Copy as Plain Text',
    'ctx.bold': 'Bold', 'ctx.italic': 'Italic', 'ctx.code': 'Code Block',
    'ctx.list': 'Make List', 'ctx.removeFormat': 'Remove Formatting',
    'ctx.editText': 'Edit Text',
    'ctx.addNote': 'Add Note', 'ctx.editNote': 'Edit Note',
    'ctx.deleteNote': 'Delete Note', 'ctx.findNote': 'Find Note',
    'ctx.insertImage': 'Insert Image', 'ctx.deleteImage': 'Delete Image',
    'ctx.addToSlider': 'Add to Slider',
    'ctx.selectAll': 'Select All',
    'ctx.openFolder': 'Open Containing Folder', 'ctx.copyPath': 'Copy Path',
    'ctx.removeRecent': 'Remove from Recent',
    'addNote': 'Add Note', 'editNote': 'Edit Note',
    'label': 'Label', 'labelPlaceholder': 'Label name...',
    'color': 'Color', 'note': 'Note',
    'noteTitlePlaceholder': 'Note title...', 'notePlaceholder': 'Write your note...',
    'findNote': 'Find Note', 'idOrTitle': 'ID or Title',
    'findNotePlaceholder': '#1 or note title...',
    'searchNotes': 'Search Notes', 'notesSearchPlaceholder': '#ID or title...',
    'editText': 'Edit Text', 'editTextLabel': 'Edit the selected text:',
    'notif.textEdited': 'Text updated',
    'zoom': 'Zoom',
    'language': 'Language', 'document': 'Document', 'interface': 'Interface',
    'original': 'Original', 'english': 'English', 'turkish': 'Turkish',
    'notif.translationFailed': 'Translation failed: ',
    'notif.translationInProgress': 'Translation in progress...',
    'notif.sectionNotFound': 'Section not found: ',
    'notif.fileNotFound': 'File not found: ',
    'notif.preparingWord': 'Preparing Word export...',
    'notif.pdfExported': 'PDF exported: ',
    'notif.wordExported': 'Word exported: ',
    'notif.copyFailed': 'Failed to copy to clipboard',
    'notif.fileDeleted': 'Warning: The opened file has been deleted from disk',
    'notif.fileReloaded': 'File reloaded successfully',
    'notif.reloadFailed': 'Failed to reload file: ',
    'notif.noTextSelected': 'No text selected',
    'notif.copied': 'Copied to clipboard',
    'notif.copyError': 'Failed to copy: ',
    'notif.copiedPlain': 'Copied as plain text',
    'notif.textNotFound': 'Could not find text in source',
    'notif.boldApplied': 'Applied bold formatting',
    'notif.italicApplied': 'Applied italic formatting',
    'notif.codeApplied': 'Applied code formatting',
    'notif.listApplied': 'Applied list formatting',
    'notif.formatRemoved': 'Removed formatting',
    'notif.noteRemoved': 'Note removed',
    'notif.noteNotFound': 'Could not find note in source',
    'notif.enterLabel': 'Please enter a label name',
    'notif.enterTitleOrContent': 'Please enter a title or note content',
    'notif.noteUpdated': 'Note updated',
    'notif.noteAdded': 'Note added',
    'notif.imageNotFound': 'Could not find image in source',
    'notif.noteAddedToImage': 'Note added to image',
    'notif.enterNoteId': 'Please enter a note ID or title',
    'notif.noteSearchNotFound': 'Note "${val}" not found',
    'notif.openFileFirst': 'Please open a file first',
    'notif.imageInserted': 'Image inserted',
    'notif.imageInsertedCompressed': 'Image inserted (${from} → ${to})',
    'notif.imageFailed': 'Failed to load image: ',
    'notif.imageProcessFailed': 'Failed to process image',
    'notif.imageDeleted': 'Image deleted',
    'notif.pathCopied': 'Path copied to clipboard',
    'notif.pathCopiedCheck': '✓ Path copied to clipboard',
    'confirm.unsavedOpen': 'You have unsaved changes. Discard changes and open a new file?',
    'confirm.unsavedRefresh': 'You have unsaved changes. Discard changes and refresh from disk?',
    'confirm.unsavedExit': 'You have unsaved changes. Exit edit mode anyway?',
    'confirm.unsavedOpenFile': 'You have unsaved changes. Discard changes and open "${name}"?',
    'confirm.clearRecent': 'Are you sure you want to clear all recent files?',
    'alert.openFirst': 'Please open a markdown file first before exporting to PDF.',
    'alert.openFirstWord': 'Please open a markdown file first before exporting to Word.',
    'alert.noFileOpen': 'No file is currently open.',
    'alert.pdfFailed': 'Failed to export PDF: ',
    'alert.wordFailed': 'Failed to export Word document: ',
    'alert.saveFailed': 'Failed to save file: ',
    'alert.wordError': 'Error preparing Word export: ',
    'update.downloading': 'Downloading Update',
    'update.ready': 'Update Ready',
    'update.error': 'Update Error',
    'update.versionReady': 'Version ${version} is ready to download',
    'update.versionInstall': 'Version ${version} is ready to install',
    'update.failed': 'Failed to check for updates',
    'update.download': 'Download',
    'update.openDownloadPage': 'Open Download Page',
    'search.counter': '${current} of ${total}',
    'search.zero': '0 of 0',
    'mermaid.error': 'Could not convert diagram to image.',
  },
  tr: {
    'open': 'Aç', 'edit': 'Düzenle', 'pdf': 'PDF', 'word': 'Word',
    'file': 'Dosya', 'title.file': 'Dosya',
    'openFile': 'Dosya Aç', 'export': 'Dışa Aktar',
    'exportPdf': 'PDF Olarak Dışa Aktar', 'exportWord': 'Word Olarak Dışa Aktar',
    'history': 'Geçmiş', 'editMode': 'Düzenleme Modu',
    'allNotes': 'Tüm Notlar', 'noNotes': 'Not bulunamadı',
    'view': 'Görünüm', 'title.view': 'Görünüm',
    'tools': 'Araçlar', 'darkMode': 'Karanlık Mod', 'corporateMode': 'Kurumsal Mod', 'fullscreen': 'Tam Ekran', 'showNotes': 'Notları Göster',
    'corporateModeEnabled': 'Kurumsal antet etkinleştirildi', 'corporateModeDisabled': 'Kurumsal antet devre dışı',
    'save': 'Kaydet', 'reload': 'Yenile', 'dismiss': 'Kapat',
    'cancel': 'İptal', 'find': 'Bul', 'later': 'Sonra', 'exit': 'Çıkış',
    'title.open': 'Dosya Aç (Ctrl+O)', 'title.recent': 'Son Dosyalar',
    'title.toc': 'İçindekiler', 'title.edit': 'Düzenleme Modu',
    'title.exitEdit': 'Düzenleme Modundan Çık',
    'title.pdf': 'PDF Olarak Dışa Aktar', 'title.word': 'Word Olarak Dışa Aktar',
    'title.zoomOut': 'Küçült (Ctrl+-)', 'title.zoomReset': 'Yakınlaştırmayı Sıfırla (Ctrl+0)',
    'title.zoomIn': 'Büyüt (Ctrl++)', 'title.darkMode': 'Karanlık Mod',
    'title.tools': 'Araçlar', 'title.fullscreen': 'Tam Ekran (F11)',
    'title.back': 'Geri (Sol Ok)', 'title.forward': 'İleri (Sağ Ok)',
    'title.refresh': 'Belgeyi Yenile (Ctrl+R)', 'title.save': 'Kaydet (Ctrl+S)',
    'title.clearRecent': 'Tüm Son Dosyaları Temizle',
    'title.searchPrev': 'Önceki (Shift+Enter)', 'title.searchNext': 'Sonraki (Enter)',
    'title.searchClose': 'Kapat (Esc)', 'title.removeRecent': 'Son dosyalardan kaldır',
    'title.note': 'Başlık',
    'recentFiles': 'Son Dosyalar', 'tableOfContents': 'İçindekiler',
    'rawMarkdown': 'Ham Markdown', 'loading': 'Yükleniyor...',
    'searchPlaceholder': 'Belgede ara...', 'noRecentFiles': 'Son dosya yok',
    'noHeaders': 'Başlık bulunamadı', 'unsaved': '● Kaydedilmemiş',
    'editorPlaceholder': 'Markdown yazmaya başlayın...',
    'welcome.title': 'Omnicore Markdown Viewer\'a Hoş Geldiniz',
    'welcome.subtitle': 'Bir markdown dosyası açmak için Ctrl+O tuşlayın',
    'welcome.features': 'Özellikler',
    'fileUpdated': 'Dosya Güncellendi',
    'fileModifiedExternally': 'Bu dosya harici olarak değiştirildi',
    'updateAvailable': 'Güncelleme Mevcut', 'newVersionAvailable': 'Yeni bir sürüm mevcut',
    'downloadUpdate': 'Güncellemeyi İndir', 'restartInstall': 'Yeniden Başlat ve Kur',
    'ctx.copy': 'Kopyala', 'ctx.copyPlain': 'Düz Metin Olarak Kopyala',
    'ctx.bold': 'Kalın', 'ctx.italic': 'İtalik', 'ctx.code': 'Kod Bloğu',
    'ctx.list': 'Liste Yap', 'ctx.removeFormat': 'Biçimlendirmeyi Kaldır',
    'ctx.editText': 'Metni Düzenle',
    'ctx.addNote': 'Not Ekle', 'ctx.editNote': 'Notu Düzenle',
    'ctx.deleteNote': 'Notu Sil', 'ctx.findNote': 'Not Bul',
    'ctx.insertImage': 'Resim Ekle', 'ctx.deleteImage': 'Resmi Sil',
    'ctx.addToSlider': 'Slider\'a Ekle',
    'ctx.selectAll': 'Tümünü Seç',
    'ctx.openFolder': 'Klasörü Aç', 'ctx.copyPath': 'Yolu Kopyala',
    'ctx.removeRecent': 'Son Dosyalardan Kaldır',
    'addNote': 'Not Ekle', 'editNote': 'Notu Düzenle',
    'label': 'Etiket', 'labelPlaceholder': 'Etiket adı...',
    'color': 'Renk', 'note': 'Not',
    'noteTitlePlaceholder': 'Not başlığı...', 'notePlaceholder': 'Notunuzu yazın...',
    'findNote': 'Not Bul', 'idOrTitle': 'ID veya Başlık',
    'findNotePlaceholder': '#1 veya not başlığı...',
    'searchNotes': 'Notlarda Ara', 'notesSearchPlaceholder': '#ID veya başlık...',
    'editText': 'Metni Düzenle', 'editTextLabel': 'Seçili metni düzenleyin:',
    'notif.textEdited': 'Metin güncellendi',
    'zoom': 'Yakınlaştır',
    'language': 'Dil', 'document': 'Belge', 'interface': 'Arayüz',
    'original': 'Orijinal', 'english': 'İngilizce', 'turkish': 'Türkçe',
    'notif.translationFailed': 'Çeviri başarısız: ',
    'notif.translationInProgress': 'Çeviri devam ediyor...',
    'notif.sectionNotFound': 'Bölüm bulunamadı: ',
    'notif.fileNotFound': 'Dosya bulunamadı: ',
    'notif.preparingWord': 'Word dışa aktarma hazırlanıyor...',
    'notif.pdfExported': 'PDF dışa aktarıldı: ',
    'notif.wordExported': 'Word dışa aktarıldı: ',
    'notif.copyFailed': 'Panoya kopyalama başarısız',
    'notif.fileDeleted': 'Uyarı: Açılan dosya diskten silinmiş',
    'notif.fileReloaded': 'Dosya başarıyla yenilendi',
    'notif.reloadFailed': 'Dosya yenilenemedi: ',
    'notif.noTextSelected': 'Metin seçilmedi',
    'notif.copied': 'Panoya kopyalandı',
    'notif.copyError': 'Kopyalama başarısız: ',
    'notif.copiedPlain': 'Düz metin olarak kopyalandı',
    'notif.textNotFound': 'Kaynak metinde bulunamadı',
    'notif.boldApplied': 'Kalın biçimlendirme uygulandı',
    'notif.italicApplied': 'İtalik biçimlendirme uygulandı',
    'notif.codeApplied': 'Kod biçimlendirme uygulandı',
    'notif.listApplied': 'Liste biçimlendirme uygulandı',
    'notif.formatRemoved': 'Biçimlendirme kaldırıldı',
    'notif.noteRemoved': 'Not silindi',
    'notif.noteNotFound': 'Not kaynakta bulunamadı',
    'notif.enterLabel': 'Lütfen bir etiket adı girin',
    'notif.enterTitleOrContent': 'Lütfen bir başlık veya not içeriği girin',
    'notif.noteUpdated': 'Not güncellendi',
    'notif.noteAdded': 'Not eklendi',
    'notif.imageNotFound': 'Resim kaynakta bulunamadı',
    'notif.noteAddedToImage': 'Resme not eklendi',
    'notif.enterNoteId': 'Lütfen bir not ID\'si veya başlığı girin',
    'notif.noteSearchNotFound': '"${val}" notu bulunamadı',
    'notif.openFileFirst': 'Lütfen önce bir dosya açın',
    'notif.imageInserted': 'Resim eklendi',
    'notif.imageInsertedCompressed': 'Resim eklendi (${from} → ${to})',
    'notif.imageFailed': 'Resim yüklenemedi: ',
    'notif.imageProcessFailed': 'Resim işlenemedi',
    'notif.imageDeleted': 'Resim silindi',
    'notif.pathCopied': 'Yol panoya kopyalandı',
    'notif.pathCopiedCheck': '✓ Yol panoya kopyalandı',
    'confirm.unsavedOpen': 'Kaydedilmemiş değişiklikler var. Değişiklikleri silip yeni dosya açılsın mı?',
    'confirm.unsavedRefresh': 'Kaydedilmemiş değişiklikler var. Değişiklikleri silip diskten yenilensin mi?',
    'confirm.unsavedExit': 'Kaydedilmemiş değişiklikler var. Düzenleme modundan çıkılsın mı?',
    'confirm.unsavedOpenFile': 'Kaydedilmemiş değişiklikler var. Değişiklikleri silip "${name}" açılsın mı?',
    'confirm.clearRecent': 'Tüm son dosyalar temizlensin mi?',
    'alert.openFirst': 'Lütfen PDF\'e aktarmadan önce bir markdown dosyası açın.',
    'alert.openFirstWord': 'Lütfen Word\'e aktarmadan önce bir markdown dosyası açın.',
    'alert.noFileOpen': 'Şu anda açık dosya yok.',
    'alert.pdfFailed': 'PDF dışa aktarma başarısız: ',
    'alert.wordFailed': 'Word belgesi dışa aktarma başarısız: ',
    'alert.saveFailed': 'Dosya kaydetme başarısız: ',
    'alert.wordError': 'Word dışa aktarma hatası: ',
    'update.downloading': 'Güncelleme İndiriliyor',
    'update.ready': 'Güncelleme Hazır',
    'update.error': 'Güncelleme Hatası',
    'update.versionReady': 'Sürüm ${version} indirmeye hazır',
    'update.versionInstall': 'Sürüm ${version} kurulmaya hazır',
    'update.failed': 'Güncellemeler kontrol edilemedi',
    'update.download': 'İndir',
    'update.openDownloadPage': 'İndirme Sayfasını Aç',
    'search.counter': '${current} / ${total}',
    'search.zero': '0 / 0',
    'mermaid.error': 'Diyagram resme dönüştürülemedi.',
  }
};

function i18n(key, params) {
  let str = UI_STRINGS[interfaceLang]?.[key] || UI_STRINGS.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace('${' + k + '}', v);
    }
  }
  return str;
}

function applyInterfaceLang(lang) {
  interfaceLang = lang;
  localStorage.setItem('interfaceLang', lang);

  // Update all data-i18n elements (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const str = UI_STRINGS[lang]?.[key];
    if (str) el.textContent = str;
  });

  // Update all data-i18n-title elements (title attribute)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const str = UI_STRINGS[lang]?.[key];
    if (str) el.title = str;
  });

  // Update all data-i18n-placeholder elements (placeholder attribute)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const str = UI_STRINGS[lang]?.[key];
    if (str) el.placeholder = str;
  });

  // Update tools menu state (checkmarks)
  updateToolsMenuState();
}

const TIMING = {
  previewDebounceDelay: 400,   // Editor input debounce (was 3000ms)
  previewRenderDelay: 400      // Preview render debounce
};

// Debounce delay constant used in formatting operations
const PREVIEW_DEBOUNCE_DELAY = 400;

const STORAGE = {
  maxRecentFiles: 100
};

// ============================================
// APPLICATION STATE
// ============================================
let zoomLevel = ZOOM_CONFIG.level;

// ============================================
// DOM ELEMENT REFERENCES
// ============================================
const viewer = document.getElementById('viewer');
const openFileBtn = document.getElementById('openFile');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const fullscreenToggle = document.getElementById('fullscreenToggle');
const showNotesToggle = document.getElementById('showNotesToggle');
const fileBtn = document.getElementById('fileBtn');
const fileMenu = document.getElementById('fileMenu');
const fileMenuRecent = document.getElementById('fileMenuRecent');
const viewBtn = document.getElementById('viewBtn');
const viewMenu = document.getElementById('viewMenu');
const logoLink = document.getElementById('logoLink');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchCounter = document.getElementById('searchCounter');
const searchPrevBtn = document.getElementById('searchPrev');
const searchNextBtn = document.getElementById('searchNext');
const searchCloseBtn = document.getElementById('searchClose');
const toggleIndexBtn = document.getElementById('toggleIndex');
const closeIndexBtn = document.getElementById('closeIndex');
const indexPanel = document.getElementById('indexPanel');
const indexList = document.getElementById('indexList');
const toggleNotesBtn = document.getElementById('toggleNotes');
const closeNotesBtn = document.getElementById('closeNotes');
const notesPanel = document.getElementById('notesPanel');
const notesList = document.getElementById('notesList');
const notesSearchToggle = document.getElementById('notesSearchToggle');
const notesSearchBar = document.getElementById('notesSearchBar');
const notesSearchInput = document.getElementById('notesSearchInput');
const fileInfoBar = document.getElementById('fileInfoBar');
const fileName = document.getElementById('fileName');
const filePath = document.getElementById('filePath');
const refreshBtn = document.getElementById('refreshBtn');
const exportPdfBtn = document.getElementById('exportPdf');
const exportWordBtn = document.getElementById('exportWord');
const toggleEditBtn = document.getElementById('toggleEdit');
const editorPanel = document.getElementById('editorPanel');
const markdownEditor = document.getElementById('markdownEditor');
const saveButton = document.getElementById('saveButton');
const exitEditBtn = document.getElementById('exitEditBtn');
const unsavedIndicator = document.getElementById('unsavedIndicator');
const contentWrapper = document.querySelector('.content-wrapper');
const loadingScreen = document.getElementById('loadingScreen');
const darkModeToggle = document.getElementById('darkModeToggle');

// Current file tracking
let currentFilePath = null;

// ============================================
// UNDO / REDO HISTORY
// ============================================
const MAX_UNDO_HISTORY = 100;
let undoHistory = [];   // past states (string[])
let redoHistory = [];   // future states (string[])

function historyPush(content) {
  if (undoHistory.length > 0 && undoHistory[undoHistory.length - 1] === content) return;
  undoHistory.push(content);
  if (undoHistory.length > MAX_UNDO_HISTORY) undoHistory.shift();
  redoHistory = []; // clear redo on new change
}

function historyUndo() {
  if (undoHistory.length === 0) return;
  const currentContent = isEditMode ? markdownEditor.value : originalMarkdown;
  redoHistory.push(currentContent);
  const prevContent = undoHistory.pop();

  if (isEditMode) {
    markdownEditor.value = prevContent;
    hasUnsavedChanges = (prevContent !== originalMarkdown);
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => renderMarkdown(prevContent), TIMING.previewDebounceDelay);
  } else {
    originalMarkdown = prevContent;
    invalidateTranslationCache();
    renderMarkdown(prevContent);
  }
}

function historyRedo() {
  if (redoHistory.length === 0) return;
  const currentContent = isEditMode ? markdownEditor.value : originalMarkdown;
  undoHistory.push(currentContent);
  const nextContent = redoHistory.pop();

  if (isEditMode) {
    markdownEditor.value = nextContent;
    hasUnsavedChanges = (nextContent !== originalMarkdown);
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => renderMarkdown(nextContent), TIMING.previewDebounceDelay);
  } else {
    originalMarkdown = nextContent;
    invalidateTranslationCache();
    renderMarkdown(nextContent);
  }
}

function historyClear() {
  undoHistory = [];
  redoHistory = [];
}

// ============================================
// CORPORATE MODE
// ============================================
let corporateMode = false; // Always starts disabled; user must press Ctrl+Shift+O to enable

function setCorporateMode(enabled) {
  corporateMode = enabled;
  const toggleEl = document.getElementById('corporateModeToggle');
  if (toggleEl) toggleEl.classList.toggle('active', enabled);
  if (enabled) {
    document.body.classList.add('corporate-mode');
  } else {
    document.body.classList.remove('corporate-mode');
  }
}

// Initialize corporate mode on startup
if (corporateMode) {
  document.body.classList.add('corporate-mode');
}

// File watching state
let isFileTrackingActive = false;
let fileUpdateNotificationShown = false;
let fileUpdateDismissTimeout = null;

// Editor state
let isEditMode = false;
let hasUnsavedChanges = false;
let originalMarkdown = '';
let previewDebounceTimer = null;

// Navigation history (for back/forward)
let navigationHistory = [];
let navigationIndex = -1;
let isNavigating = false; // Flag to prevent adding to history during back/forward

// Translation state
const toolsBtn = document.getElementById('toolsBtn');
const toolsMenu = document.getElementById('toolsMenu');
const langSubmenu = document.getElementById('langSubmenu');
let translatedMarkdown = null;        // cached translation for current target lang
let isShowingTranslation = false;     // currently displaying translated version
let isBackgroundTranslating = false;  // bg translation in progress
let translationGeneration = 0;        // stale-detection counter
let translationResolvers = [];        // waiters for bg translation completion
let translationPieceCache = new Map(); // piece-level cache: original text → translated text
let translationTargetLang = null;     // current target language ('en', 'tr', etc.) or null

// Update file info display
function updateFileInfo(path) {
  if (!path) {
    fileInfoBar.style.display = 'none';
    currentFilePath = null;
    return;
  }

  currentFilePath = path;
  const pathParts = path.split(/[\\/]/);
  const name = pathParts.pop();
  const directory = pathParts.join('/');

  fileName.textContent = name;
  filePath.textContent = directory;
  fileInfoBar.style.display = 'flex';
}

// Copy path to clipboard on click
filePath.addEventListener('click', () => {
  if (currentFilePath) {
    navigator.clipboard.writeText(currentFilePath).then(() => {
      // Visual feedback
      const originalText = filePath.textContent;
      filePath.textContent = i18n('notif.pathCopiedCheck');
      filePath.style.color = 'var(--primary-color)';
      setTimeout(() => {
        const pathParts = currentFilePath.split(/[\\/]/);
        pathParts.pop(); // Remove filename
        filePath.textContent = pathParts.join('/');
        filePath.style.color = '';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy path:', err);
    });
  }
});

// Navigation history functions
const navBackBtn = document.getElementById('navBackBtn');
const navForwardBtn = document.getElementById('navForwardBtn');

function updateNavButtons() {
  if (navBackBtn) navBackBtn.disabled = navigationIndex <= 0;
  if (navForwardBtn) navForwardBtn.disabled = navigationIndex >= navigationHistory.length - 1;
}

function addToNavigationHistory(filePath, scrollPosition = 0) {
  if (isNavigating) return; // Don't add during back/forward navigation

  // Update scroll position of current entry before navigating away
  if (navigationIndex >= 0 && navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  // Remove any forward history when navigating to new file
  if (navigationIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, navigationIndex + 1);
  }

  // Don't add if it's the same file
  if (navigationHistory.length > 0 && navigationHistory[navigationHistory.length - 1].filePath === filePath) {
    return;
  }

  navigationHistory.push({ filePath, scrollPosition });
  navigationIndex = navigationHistory.length - 1;
  updateNavButtons();
}

function navigateBack() {
  if (navigationIndex <= 0) return;

  // Save current scroll position
  if (navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  navigationIndex--;
  const entry = navigationHistory[navigationIndex];
  if (entry) {
    isNavigating = true;
    ipcRenderer.send('open-file-path', entry.filePath);
    // Scroll position will be restored when file loads
  }
  updateNavButtons();
}

function navigateForward() {
  if (navigationIndex >= navigationHistory.length - 1) return;

  // Save current scroll position
  if (navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  navigationIndex++;
  const entry = navigationHistory[navigationIndex];
  if (entry) {
    isNavigating = true;
    ipcRenderer.send('open-file-path', entry.filePath);
    // Scroll position will be restored when file loads
  }
  updateNavButtons();
}

// Navigation button click handlers
if (navBackBtn) navBackBtn.addEventListener('click', navigateBack);
if (navForwardBtn) navForwardBtn.addEventListener('click', navigateForward);

// Keyboard navigation (left/right arrows)
document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in input/textarea or if modifier keys are pressed
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateBack();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateForward();
  }
});

// Update zoom display
function updateZoom() {
  viewer.style.zoom = `${zoomLevel / 100}`;
  zoomResetBtn.textContent = `${zoomLevel}%`;
}

// ============================================
// ZOOM CONTROLS
// ============================================

zoomInBtn.addEventListener('click', () => {
  if (zoomLevel < ZOOM_CONFIG.max) {
    zoomLevel += ZOOM_CONFIG.step;
    updateZoom();
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (zoomLevel > ZOOM_CONFIG.min) {
    zoomLevel -= ZOOM_CONFIG.step;
    updateZoom();
  }
});

zoomResetBtn.addEventListener('click', () => {
  zoomLevel = ZOOM_CONFIG.level;
  updateZoom();
});

// Dark mode toggle
darkModeToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
  darkModeToggle.classList.toggle('active', isDarkMode);

  // Re-initialize Mermaid with new theme if there are diagrams
  const mermaidElements = document.querySelectorAll('.mermaid');
  if (mermaidElements.length > 0) {
    updateMermaidTheme(isDarkMode);
  }

  // Update OmniWare dark mode
  updateOmniWareDarkMode(isDarkMode);
});

// Translation — background preemptive system
const TRANSLATE_GLOBE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';

function updateToolsMenuState() {
  // Document section checkmarks
  langSubmenu.querySelectorAll('.tools-submenu-item[data-section="doc"]').forEach(item => {
    const lang = item.dataset.lang;
    const isActive = (lang === 'original' && !isShowingTranslation) ||
                     (lang === translationTargetLang && isShowingTranslation);
    item.classList.toggle('active', isActive);
  });
  // Interface section checkmarks
  langSubmenu.querySelectorAll('.tools-submenu-item[data-section="ui"]').forEach(item => {
    item.classList.toggle('active', item.dataset.lang === interfaceLang);
  });
  toolsBtn.classList.toggle('translated', isShowingTranslation);
}

function startBackgroundTranslation(softMode) {
  if (!translationTargetLang) return; // no target language selected
  const gen = ++translationGeneration;
  if (!softMode) translatedMarkdown = null;

  // If already translating, just bump generation — the running translation
  // will detect staleness on completion and auto-retry with latest content
  if (isBackgroundTranslating) return;

  isBackgroundTranslating = true;
  toolsBtn.classList.add('translating');

  translateMarkdownDocument(originalMarkdown, translationTargetLang)
    .then(result => {
      isBackgroundTranslating = false;
      if (gen !== translationGeneration) {
        // Content changed while translating — auto-retry with latest
        startBackgroundTranslation(softMode);
        return;
      }
      translatedMarkdown = result;
      toolsBtn.classList.remove('translating');

      // Resolve any waiters
      translationResolvers.forEach(r => r());
      translationResolvers = [];

      // Auto-update view if showing translation
      if (isShowingTranslation) {
        const scrollPos = contentWrapper.scrollTop;
        renderMarkdown(translatedMarkdown).then(() => {
          contentWrapper.scrollTop = scrollPos;
          hideLoadingScreen();
        });
      }
    })
    .catch(err => {
      isBackgroundTranslating = false;
      if (gen !== translationGeneration) {
        // Content changed while translating — auto-retry
        startBackgroundTranslation(softMode);
        return;
      }
      console.error('Background translation error:', err);
      toolsBtn.classList.remove('translating');
      translationResolvers.forEach(r => r());
      translationResolvers = [];
      if (!softMode && isShowingTranslation) {
        isShowingTranslation = false;
        updateToolsMenuState();
        hideLoadingScreen();
        showNotification(i18n('notif.translationFailed') + err.message, 4000);
      }
    });
}

function waitForTranslation() {
  if (translatedMarkdown) return Promise.resolve();
  return new Promise(resolve => translationResolvers.push(resolve));
}

function invalidateTranslationCache() {
  translatedMarkdown = null;
  if (currentFilePath && originalMarkdown) {
    startBackgroundTranslation();
  }
}

function resetTranslationState() {
  translationGeneration++;
  translatedMarkdown = null;
  isShowingTranslation = false;
  isBackgroundTranslating = false;
  translationTargetLang = null;
  translationResolvers.forEach(r => r());
  translationResolvers = [];
  translationPieceCache.clear();
  pendingNoteAttrTranslations.clear();
  toolsBtn.classList.remove('translating');
  updateToolsMenuState();
}

// Get the markdown source for the currently active view
function getActiveMarkdown() {
  return (isShowingTranslation && translatedMarkdown) ? translatedMarkdown : originalMarkdown;
}

// Reverse-lookup: find original text for a translated text via piece cache
function findOriginalForTranslated(translatedText) {
  for (const [original, translated] of translationPieceCache) {
    if (translated === translatedText) return original;
    if (translated.trim() === translatedText.trim()) return original;
  }
  return null;
}

// Find note span by data-note-id in source markdown
function findNoteSpanById(source, noteId) {
  if (!noteId) return null;
  const safeId = noteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<span class="(?:noted-text|noted-image|note-label)" data-note-id="${safeId}"[^>]*>([\\s\\S]*?)</span>`
  );
  return source.match(regex);
}

// Sync a note-span addition from translatedMarkdown to originalMarkdown
function syncNoteAddToOriginal(noteHtml, selectedText, noteId, rawTitle, rawContent, occurrence) {
  occurrence = occurrence || 0;
  // Extract note attrs from noteHtml to rebuild for original text
  const escTitleMatch = noteHtml.match(/data-note-title="([^"]*)"/);
  const escContentMatch = noteHtml.match(/data-note-content="([^"]*)"/);
  let colorMatch = noteHtml.match(/data-note-color="([^"]*)"/);
  if (!colorMatch) colorMatch = noteHtml.match(/style="color:([^"]*)"/);
  const escT = escTitleMatch ? escTitleMatch[1] : '';
  const escC = escContentMatch ? escContentMatch[1] : '';
  const col = colorMatch ? colorMatch[1] : '#ff6600';

  function buildOrigNoteHtml(origText) {
    return wrapWithNoteSpan(origText, noteId, escT, escC, col);
  }

  // Strategy 1: reverse piece cache lookup (instant, accurate)
  const origText = findOriginalForTranslated(selectedText);
  if (origText) {
    const idx = findNthOccurrence(originalMarkdown, origText, occurrence);
    if (idx !== -1) {
      originalMarkdown = originalMarkdown.substring(0, idx) + buildOrigNoteHtml(origText) + originalMarkdown.substring(idx + origText.length);
      translateNoteAttrsToOriginal(noteId, rawTitle, rawContent);
      return;
    }
  }

  // Strategy 2: substring match in piece cache
  for (const [original, translated] of translationPieceCache) {
    if (translated.includes(selectedText) && selectedText.length > 0) {
      const idx = findNthOccurrence(originalMarkdown, original, occurrence);
      if (idx !== -1) {
        originalMarkdown = originalMarkdown.substring(0, idx) + buildOrigNoteHtml(original) + originalMarkdown.substring(idx + original.length);
        translateNoteAttrsToOriginal(noteId, rawTitle, rawContent);
        return;
      }
    }
  }

  // Strategy 3: async reverse-translate via Google (fallback)
  googleTranslate(selectedText, 'tr').then(trText => {
    if (!trText) throw new Error('Empty reverse translation');
    const idx = findNthOccurrence(originalMarkdown, trText, occurrence);
    if (idx !== -1) {
      originalMarkdown = originalMarkdown.substring(0, idx) + buildOrigNoteHtml(trText) + originalMarkdown.substring(idx + trText.length);
      translateNoteAttrsToOriginal(noteId, rawTitle, rawContent);
    } else {
      throw new Error('Reverse translation not found in original');
    }
  }).catch(() => {
    // Strategy 4: guaranteed fallback — append note to end
    if (!findNoteSpanById(originalMarkdown, noteId)) {
      originalMarkdown = originalMarkdown.trimEnd() + '\n\n' + noteHtml + '\n';
      translateNoteAttrsToOriginal(noteId, rawTitle, rawContent);
    }
  });
}

// Pending note attr translations — noteId -> {rawTitle, rawContent}
const pendingNoteAttrTranslations = new Map();

// Immediately translate note attrs EN→TR and apply to originalMarkdown; queue as fallback on failure
async function translateNoteAttrsToOriginal(noteId, rawTitle, rawContent) {
  if (!noteId || (!rawTitle && !rawContent)) return;
  try {
    const [trTitle, trContent] = await Promise.all([
      rawTitle ? googleTranslate(rawTitle, 'tr') : Promise.resolve(null),
      rawContent ? googleTranslate(rawContent, 'tr') : Promise.resolve(null)
    ]);

    const match = findNoteSpanById(originalMarkdown, noteId);
    if (!match) {
      // Note span not yet synced to originalMarkdown — queue for later
      pendingNoteAttrTranslations.set(noteId, { rawTitle, rawContent });
      return;
    }

    let updated = match[0];
    if (trTitle) {
      const esc = trTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      updated = updated.replace(/data-note-title="[^"]*"/, () => `data-note-title="${esc}"`);
    }
    if (trContent) {
      const esc = trContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      updated = updated.replace(/data-note-content="[^"]*"/, () => `data-note-content="${esc}"`);
    }

    if (updated !== match[0]) {
      originalMarkdown = originalMarkdown.substring(0, match.index) + updated + originalMarkdown.substring(match.index + match[0].length);
    }
  } catch (e) {
    // Translation failed — queue for retry on view switch
    pendingNoteAttrTranslations.set(noteId, { rawTitle, rawContent });
  }
}

// Flush: translate all pending note attrs EN→TR and apply to originalMarkdown
async function flushPendingNoteTranslations() {
  const entries = [...pendingNoteAttrTranslations.entries()];
  pendingNoteAttrTranslations.clear();
  if (!entries.length) return;

  await Promise.all(entries.map(async ([noteId, { rawTitle, rawContent }]) => {
    try {
      const [trTitle, trContent] = await Promise.all([
        rawTitle ? googleTranslate(rawTitle, 'tr') : Promise.resolve(null),
        rawContent ? googleTranslate(rawContent, 'tr') : Promise.resolve(null)
      ]);

      const match = findNoteSpanById(originalMarkdown, noteId);
      if (!match) return;

      let updated = match[0];
      if (trTitle) {
        const esc = trTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        updated = updated.replace(/data-note-title="[^"]*"/, () => `data-note-title="${esc}"`);
      }
      if (trContent) {
        const esc = trContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        updated = updated.replace(/data-note-content="[^"]*"/, () => `data-note-content="${esc}"`);
      }

      if (updated !== match[0]) {
        originalMarkdown = originalMarkdown.substring(0, match.index) + updated + originalMarkdown.substring(match.index + match[0].length);
      }
    } catch (e) {}
  }));
}

// Debounced resync timer for EN view edits
let enViewResyncTimer = null;

// Apply a view-mode content change and keep both markdowns in sync
function commitViewModeEdit(newContent, scrollPosition, syncFn) {
  if (isShowingTranslation && translatedMarkdown) {
    translatedMarkdown = newContent;
    if (syncFn) syncFn();
    renderMarkdown(translatedMarkdown).then(() => {
      contentWrapper.scrollTop = scrollPosition;
    });
    // Debounced resync: re-translate originalMarkdown in background for eventual consistency
    clearTimeout(enViewResyncTimer);
    enViewResyncTimer = setTimeout(() => {
      if (isShowingTranslation && originalMarkdown) startBackgroundTranslation(true);
    }, 2000);
  } else {
    originalMarkdown = newContent;
    invalidateTranslationCache();
    renderMarkdown(newContent).then(() => {
      contentWrapper.scrollTop = scrollPosition;
    });
  }
  hasUnsavedChanges = true;
}

// Update markdown source without triggering a full re-render (used when DOM is already patched).
function updateSourceSilently(newContent, syncFn) {
  if (isShowingTranslation && translatedMarkdown) {
    translatedMarkdown = newContent;
    if (syncFn) syncFn();
    clearTimeout(enViewResyncTimer);
    enViewResyncTimer = setTimeout(() => {
      if (isShowingTranslation && originalMarkdown) startBackgroundTranslation(true);
    }, 2000);
  } else {
    originalMarkdown = newContent;
    invalidateTranslationCache();
    if (syncFn) syncFn();
  }
  hasUnsavedChanges = true;
}

// Wrap the saved DOM range in an inline element (strong/em/code) without re-rendering.
// Returns true on success, false if the range spans multiple elements (fall back to full render).
function patchInlineFormatInDOM(tagName) {
  if (!savedRange) return false;
  try {
    const el = document.createElement(tagName);
    savedRange.surroundContents(el);
    return true;
  } catch (e) {
    return false;
  }
}

// Remove an inline formatting element (strong/em/code) wrapping the saved selection in the DOM.
// Returns true on success, false if not applicable (fall back to full render).
function patchRemoveFormatInDOM() {
  if (!savedRange) return false;
  try {
    const ancestor = savedRange.commonAncestorContainer;
    let node = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    while (node && node !== viewer) {
      if (['STRONG', 'EM', 'CODE'].includes(node.tagName)) {
        const textNode = document.createTextNode(node.textContent);
        node.parentNode.replaceChild(textNode, node);
        return true;
      }
      node = node.parentElement;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function closeAllDropdowns() {
  fileMenu.classList.remove('visible');
  viewMenu.classList.remove('visible');
  toolsMenu.classList.remove('visible');
}

// File menu toggle
fileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = !fileMenu.classList.contains('visible');
  closeAllDropdowns();
  if (willOpen) {
    fileMenu.classList.add('visible');
    updateFileMenuRecent();
  }
});

// View menu toggle
viewBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = !viewMenu.classList.contains('visible');
  closeAllDropdowns();
  if (willOpen) viewMenu.classList.add('visible');
});

// Tools menu toggle
toolsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = !toolsMenu.classList.contains('visible');
  closeAllDropdowns();
  if (willOpen) toolsMenu.classList.add('visible');
});

// Close all menus on outside click
document.addEventListener('click', () => {
  closeAllDropdowns();
});

// Prevent clicks inside menus from closing them
fileMenu.addEventListener('click', (e) => { e.stopPropagation(); });
viewMenu.addEventListener('click', (e) => { e.stopPropagation(); });
toolsMenu.addEventListener('click', (e) => { e.stopPropagation(); });

// Language switch handler
async function switchToLanguage(targetLang) {
  if (!originalMarkdown || !currentFilePath) return;

  if (targetLang === 'original') {
    if (!isShowingTranslation) return;
    await flushPendingNoteTranslations();
    isShowingTranslation = false;
    translationTargetLang = null;
    const scrollPos = contentWrapper.scrollTop;
    await renderMarkdown(originalMarkdown);
    contentWrapper.scrollTop = scrollPos;
    updateToolsMenuState();
    return;
  }

  // Switching to a translation language (en/tr/etc.)
  const langChanged = translationTargetLang !== targetLang;

  if (langChanged) {
    translatedMarkdown = null;
    translationPieceCache.clear();
    translationTargetLang = targetLang;
  }

  if (!langChanged && isShowingTranslation) return; // already showing this translation

  isShowingTranslation = true;

  if (translatedMarkdown) {
    // Cache is valid — instant swap
    const scrollPos = contentWrapper.scrollTop;
    await renderMarkdown(translatedMarkdown);
    contentWrapper.scrollTop = scrollPos;
  } else {
    // Non-blocking: start translation in background and let the user keep working.
    // startBackgroundTranslation will auto-render when done (if isShowingTranslation is still true).
    if (!isBackgroundTranslating) startBackgroundTranslation();
    showNotification(i18n('notif.translationInProgress'), 4000);
  }

  updateToolsMenuState();
}

// Language submenu item click handlers
langSubmenu.querySelectorAll('.tools-submenu-item').forEach(item => {
  item.addEventListener('click', async () => {
    toolsMenu.classList.remove('visible');
    const section = item.dataset.section;
    const lang = item.dataset.lang;
    if (section === 'doc') {
      await switchToLanguage(lang);
    } else if (section === 'ui') {
      applyInterfaceLang(lang);
    }
  });
});

// Load dark mode preference on startup
function loadDarkModePreference() {
  const darkMode = localStorage.getItem('darkMode');
  if (darkMode === 'enabled') {
    document.body.classList.add('dark-mode');
    darkModeToggle.classList.add('active');
  }
}

// Update Mermaid theme based on dark mode.
// Only re-renders the mermaid SVG elements in-place — no full page re-render.
// All other dark mode styling is handled instantly by the .dark-mode CSS class.
async function updateMermaidTheme(isDark) {
  mermaidSvgCache.clear(); // SVG colours are baked into the SVG, must re-render
  mermaid.initialize(getMermaidConfig(isDark));

  const mermaidElements = viewer.querySelectorAll('.mermaid');
  if (mermaidElements.length === 0) return;

  // Restore source text into each element so mermaid can re-render with new theme colors
  const toRender = [];
  mermaidElements.forEach((el, index) => {
    const src = el.dataset.mermaidSrc;
    if (!src) return;
    el.textContent = src;
    el.removeAttribute('data-processed');
    el.id = `mermaid-${Date.now()}-${index}`;
    toRender.push(el);
  });

  if (toRender.length === 0) return;

  try {
    await mermaid.run({ nodes: toRender, suppressErrors: false });
    toRender.forEach(el => {
      if (el.dataset.mermaidSrc && el.querySelector('svg')) {
        mermaidSvgCache.set(el.dataset.mermaidSrc, el.innerHTML);
      }
    });
  } catch (e) {
    console.warn('Mermaid theme update failed, falling back to full re-render:', e);
    if (originalMarkdown) renderMarkdown(getActiveMarkdown());
  }
}

/**
 * Update OmniWare wireframe dark mode styling
 * @param {boolean} isDark - Whether dark mode is enabled
 */
function updateOmniWareDarkMode(isDark) {
  const existingStyle = document.getElementById('omniware-dark-styles');
  if (isDark) {
    const css = getOmniWareDarkCSS(true);
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = 'omniware-dark-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } else if (existingStyle) {
    existingStyle.remove();
  }
}

// Load dark mode on startup
loadDarkModePreference();

// Apply saved interface language on startup
if (interfaceLang !== 'en') applyInterfaceLang(interfaceLang);
updateToolsMenuState();

// Fullscreen toggle
fullscreenToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  fullscreenToggle.classList.toggle('active', !!document.fullscreenElement);
});

// Corporate Mode toggle handler
const corporateModeToggle = document.getElementById('corporateModeToggle');
if (corporateModeToggle) {
  corporateModeToggle.classList.toggle('active', corporateMode);
  corporateModeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setCorporateMode(!corporateMode);
  });
}

// Listen for Ctrl+Shift+O from main process
ipcRenderer.on('toggle-corporate-mode', () => {
  setCorporateMode(!corporateMode);
  showNotification(i18n(corporateMode ? 'corporateModeEnabled' : 'corporateModeDisabled'), 2500);
});

// Show/Hide Notes toggle
let notesVisible = localStorage.getItem('notesVisible') !== 'hidden';

showNotesToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  notesVisible = !notesVisible;
  localStorage.setItem('notesVisible', notesVisible ? 'visible' : 'hidden');
  showNotesToggle.classList.toggle('active', notesVisible);
  viewer.classList.toggle('notes-hidden', !notesVisible);
  // Close any open tooltip when hiding notes
  if (!notesVisible) {
    noteTooltipPinned = false;
    noteTooltip.style.pointerEvents = 'none';
    noteTooltip.classList.remove('visible');
  }
});

// Update showNotesToggle visibility based on whether notes exist
function updateShowNotesToggleVisibility() {
  const hasNotes = viewer.querySelectorAll('.noted-text[data-note-id], .noted-image[data-note-id], .note-label[data-note-id]').length > 0;
  showNotesToggle.style.display = hasNotes ? '' : 'none';
  if (hasNotes) {
    showNotesToggle.classList.toggle('active', notesVisible);
    viewer.classList.toggle('notes-hidden', !notesVisible);
  } else {
    viewer.classList.remove('notes-hidden');
  }
}

// Apply background-color + underline styles to noted-text elements via JS (post-DOMPurify)
// This is the single source of truth for note visual styles — called after every render
function applyNoteStyles() {
  viewer.querySelectorAll('.noted-text').forEach(el => {
    // New format: data-note-color attribute
    let color = el.getAttribute('data-note-color');
    // Legacy fallback: inline style color
    if (!color) {
      const styleAttr = el.getAttribute('style') || '';
      const m = styleAttr.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
      if (m) color = m[1];
    }
    if (color && color.length >= 7) {
      const r = parseInt(color.slice(1,3), 16);
      const g = parseInt(color.slice(3,5), 16);
      const b = parseInt(color.slice(5,7), 16);
      el.style.backgroundColor = `rgba(${r},${g},${b},0.25)`;
      el.style.textDecoration = 'underline';
      el.style.textDecorationColor = color;
      el.style.textDecorationThickness = '2px';
      el.style.color = '';  // Clear legacy inline color
    }
  });
}

// Logo link - open website
logoLink.addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://www.omnicore.com.tr');
});

// Handle links in rendered markdown
viewer.addEventListener('click', (e) => {
  // Find the closest anchor tag (in case click was on child element)
  const link = e.target.closest('a');
  if (link && link.href) {
    const url = link.href;

    // Get the href attribute directly to handle relative paths and anchors
    const hrefAttr = link.getAttribute('href');

    // Check if it's an internal anchor link (starts with #)
    if (hrefAttr && hrefAttr.startsWith('#')) {
      e.preventDefault();
      const targetId = hrefAttr.substring(1); // Remove the # symbol

      // Try to find the target element by ID
      let targetElement = document.getElementById(targetId);

      // If not found by ID, try to find by searching all headers
      if (!targetElement) {
        const headers = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');

        for (const header of headers) {
          // Check if the header's ID matches (case-insensitive)
          if (header.id && header.id.toLowerCase() === targetId.toLowerCase()) {
            targetElement = header;
            break;
          }
          // Also check if the generated ID from text matches
          const headerText = header.textContent.trim().toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove punctuation
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
          if (headerText === targetId.toLowerCase()) {
            targetElement = header;
            break;
          }
        }
      }

      if (targetElement) {
        // Calculate the scroll position relative to contentWrapper
        const contentRect = contentWrapper.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const scrollOffset = targetRect.top - contentRect.top + contentWrapper.scrollTop - 20; // 20px padding from top

        // Scroll the content wrapper to the target
        contentWrapper.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
        });
      } else {
        showNotification(i18n('notif.sectionNotFound') + targetId, 3000);
      }
      return;
    }

    // Check if it's an external web link (http or https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      e.preventDefault();
      shell.openExternal(url);
      return;
    }

    // Check if it's a local file link (file:// or relative path)
    if (hrefAttr && !hrefAttr.startsWith('#') && !hrefAttr.startsWith('http')) {
      e.preventDefault();

      // Resolve the path relative to current file
      let targetPath = hrefAttr;

      // Handle file:// protocol
      if (targetPath.startsWith('file://')) {
        targetPath = targetPath.replace('file://', '');
        // Handle Windows paths like file:///C:/...
        if (targetPath.startsWith('/') && targetPath[2] === ':') {
          targetPath = targetPath.substring(1);
        }
      }

      // If it's a relative path, resolve it against current file's directory
      if (currentFilePath && !path.isAbsolute(targetPath)) {
        const currentDir = path.dirname(currentFilePath);
        targetPath = path.resolve(currentDir, targetPath);
      }

      // Check if the file exists
      if (fs.existsSync(targetPath)) {
        // Check if it's a markdown or mermaid file
        const ext = path.extname(targetPath).toLowerCase();
        if (['.md', '.markdown', '.mmd', '.mermaid', '.ow'].includes(ext)) {
          // Open the markdown file in this app
          ipcRenderer.send('open-file-path', targetPath);
        } else {
          // Open other files with system default app
          shell.openPath(targetPath);
        }
      } else {
        showNotification(i18n('notif.fileNotFound') + path.basename(targetPath), 4000);
      }
    }
  }
});

// Open file button (toolbar)
openFileBtn.addEventListener('click', () => {
  // Check for unsaved changes before opening file dialog
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm(i18n('confirm.unsavedOpen'))) {
      return; // User canceled, don't open file dialog
    }
  }

  fileMenu.classList.remove('visible');
  ipcRenderer.send('open-file-dialog');
});

// Welcome screen "Open File" button
const welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
if (welcomeOpenBtn) {
  welcomeOpenBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
  });
}

// Welcome screen "Read README.md" button
const welcomeReadmeBtn = document.getElementById('welcomeReadmeBtn');
if (welcomeReadmeBtn) {
  welcomeReadmeBtn.addEventListener('click', async () => {
    try {
      const readmePath = await ipcRenderer.invoke('get-readme-path');
      ipcRenderer.send('open-file-path', readmePath);
    } catch (e) {
      showNotification('README.md not found', 2000);
    }
  });
}

// Refresh button
refreshBtn.addEventListener('click', () => {
  if (!currentFilePath) {
    return;
  }

  // Check for unsaved changes before refreshing
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm(i18n('confirm.unsavedRefresh'))) {
      return;
    }
  }

  // Reload the file from disk
  reloadCurrentFile();
});

// Export to PDF button
exportPdfBtn.addEventListener('click', () => {
  fileMenu.classList.remove('visible');
  if (!currentFilePath) {
    alert(i18n('alert.openFirst'));
    return;
  }

  const pathParts = currentFilePath.split(/[\\/]/);
  const currentFileName = pathParts.pop();

  const channel = corporateMode ? 'export-pdf-corporate' : 'export-pdf';
  ipcRenderer.send(channel, { currentFileName });
});

// Convert Mermaid element to base64 PNG using native browser rendering
async function mermaidToBase64Png(mermaidElement) {
  return new Promise((resolve, reject) => {
    try {
      const svg = mermaidElement.querySelector('svg');
      if (!svg) {
        reject(new Error('No SVG found in mermaid element'));
        return;
      }

      // Get SVG dimensions
      const bbox = svg.getBBox();
      const width = bbox.width || svg.clientWidth || 800;
      const height = bbox.height || svg.clientHeight || 600;

      // Clone SVG
      const svgClone = svg.cloneNode(true);

      // Set explicit dimensions
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);

      // Ensure viewBox is set
      if (!svgClone.getAttribute('viewBox')) {
        svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      // Get all computed styles and inline them
      const allElements = svg.querySelectorAll('*');
      const clonedElements = svgClone.querySelectorAll('*');

      allElements.forEach((el, i) => {
        if (clonedElements[i]) {
          const computedStyle = window.getComputedStyle(el);
          const importantStyles = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'opacity', 'transform'];
          importantStyles.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== '') {
              clonedElements[i].style[prop] = value;
            }
          });
        }
      });

      // Handle foreignObject - extract text and convert to SVG text
      svgClone.querySelectorAll('foreignObject').forEach(fo => {
        const text = fo.textContent?.trim() || '';
        const x = fo.getAttribute('x') || '0';
        const y = fo.getAttribute('y') || '0';
        const foWidth = parseFloat(fo.getAttribute('width')) || 100;
        const foHeight = parseFloat(fo.getAttribute('height')) || 20;

        // Create SVG text element
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', parseFloat(x) + foWidth / 2);
        textEl.setAttribute('y', parseFloat(y) + foHeight / 2 + 4);
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'middle');
        textEl.setAttribute('font-family', 'Arial, sans-serif');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('fill', '#333');
        textEl.textContent = text;

        fo.parentNode.replaceChild(textEl, fo);
      });

      // Serialize SVG
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgClone);

      // Add XML declaration and namespace
      if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          // Create high-res canvas
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);

          const base64 = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve({ base64, width, height });
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

// Export to Word button
exportWordBtn.addEventListener('click', async () => {
  fileMenu.classList.remove('visible');
  if (!currentFilePath) {
    alert(i18n('alert.openFirstWord'));
    return;
  }

  try {
    // Show loading notification
    showNotification(i18n('notif.preparingWord'), 10000);

    const pathParts = currentFilePath.split(/[\\/]/);
    const currentFileName = pathParts.pop();

    // Get the HTML content from the viewer, but clean it up for Word export
    // Remove UI elements like maximize buttons, code copy buttons, etc.
    const viewerClone = viewer.cloneNode(true);

    // Remove maximize buttons from tables and mermaid diagrams
    viewerClone.querySelectorAll('.mermaid-maximize-btn, .table-maximize-btn, .code-copy-btn, .omniware-maximize-btn').forEach(el => el.remove());

    // Convert mermaid diagrams to PNG images for Word compatibility
    const mermaidContainers = viewer.querySelectorAll('.mermaid-container');
    const clonedContainers = viewerClone.querySelectorAll('.mermaid-container');

    console.log('Found', mermaidContainers.length, 'mermaid containers');

    for (let i = 0; i < mermaidContainers.length; i++) {
      const originalContainer = mermaidContainers[i];
      const clonedContainer = clonedContainers[i];
      const mermaidElement = originalContainer.querySelector('.mermaid');

      if (mermaidElement && clonedContainer) {
        try {
          console.log('Converting mermaid diagram', i + 1);

          // Scroll element into view to ensure it's visible
          mermaidElement.scrollIntoView({ block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait for scroll

          // Capture using html2canvas
          const canvas = await html2canvas(mermaidElement, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: false, // Disable to avoid issues
            onclone: (clonedDoc) => {
              // In the cloned document, find the mermaid element and ensure visibility
              const clonedMermaid = clonedDoc.querySelector('.mermaid');
              if (clonedMermaid) {
                clonedMermaid.style.display = 'block';
                clonedMermaid.style.visibility = 'visible';
              }
            }
          });

          const base64 = canvas.toDataURL('image/png');
          const width = canvas.width / 2; // Account for scale
          const height = canvas.height / 2;

          console.log('Converted diagram', i + 1, 'size:', width, 'x', height);

          // Create an img element with the base64 PNG
          const imgElement = document.createElement('img');
          imgElement.src = base64;
          imgElement.style.cssText = `max-width: 100%; height: auto; display: block; margin: 10px auto;`;
          imgElement.setAttribute('width', Math.min(width, 600)); // Limit max width for Word
          imgElement.setAttribute('height', Math.round(height * (Math.min(width, 600) / width)));

          // Replace the container with the image
          clonedContainer.parentNode.replaceChild(imgElement, clonedContainer);
        } catch (err) {
          console.error('Error converting Mermaid diagram:', err);
          // Fallback to placeholder if conversion fails
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'padding: 20px; background: #f5f5f5; border: 1px solid #ddd; text-align: center; color: #666; margin: 10px 0;';
          placeholder.innerHTML = '<strong>[Mermaid Diagram]</strong><br><em>' + i18n('mermaid.error') + '</em>';
          clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
        }
      }
    }

    // Remove code block containers wrapper divs but keep content
    viewerClone.querySelectorAll('.code-block-container').forEach(container => {
      const pre = container.querySelector('pre');
      if (pre) {
        container.parentNode.replaceChild(pre.cloneNode(true), container);
      }
    });

    // Remove table containers wrapper divs but keep tables
    viewerClone.querySelectorAll('.table-container').forEach(container => {
      const table = container.querySelector('table');
      if (table) {
        container.parentNode.replaceChild(table.cloneNode(true), container);
      }
    });

    const htmlContent = viewerClone.innerHTML;
    console.log('Sending export-word IPC, HTML length:', htmlContent.length);

    const wordChannel = corporateMode ? 'export-word-corporate' : 'export-word';
    ipcRenderer.send(wordChannel, { currentFileName, htmlContent });
  } catch (err) {
    console.error('Word export error:', err);
    alert(i18n('alert.wordError') + err.message);
  }
});

// Show notification toast
function showNotification(message, duration = 3000) {
  const toast = document.getElementById('notificationToast');
  const messageEl = document.getElementById('notificationMessage');

  messageEl.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Loading screen functions
function showLoadingScreen() {
  loadingScreen.classList.add('active');
}

function hideLoadingScreen() {
  loadingScreen.classList.remove('active');
}

// File update notification functions
function showFileUpdateNotification() {
  if (fileUpdateNotificationShown) {
    return; // Don't show multiple notifications
  }

  const toast = document.getElementById('fileUpdateToast');
  if (!toast) {
    console.error('File update toast element not found');
    return;
  }

  toast.classList.add('show');
  fileUpdateNotificationShown = true;

  // Auto-dismiss after 10 seconds
  fileUpdateDismissTimeout = setTimeout(() => {
    dismissFileUpdateNotification();
  }, 10000);
}

function dismissFileUpdateNotification() {
  const toast = document.getElementById('fileUpdateToast');
  if (toast) {
    toast.classList.remove('show');
  }
  fileUpdateNotificationShown = false;

  if (fileUpdateDismissTimeout) {
    clearTimeout(fileUpdateDismissTimeout);
    fileUpdateDismissTimeout = null;
  }
}

function reloadCurrentFile() {
  if (!currentFilePath) {
    return;
  }

  dismissFileUpdateNotification();
  ipcRenderer.send('reload-file', { filePath: currentFilePath });
}

// Before printToPDF: main signals renderer to drop dark mode for a clean light export
// Letterhead is handled by main.js via printToPDF headerTemplate/footerTemplate (every page)
ipcRenderer.on('prepare-for-pdf-export', () => {
  document.body.classList.remove('dark-mode');
  // Double rAF ensures the style change is painted before main calls printToPDF
  requestAnimationFrame(() => requestAnimationFrame(() => ipcRenderer.send('pdf-export-ready')));
});

ipcRenderer.on('pdf-export-result', (event, data) => {
  // Restore dark mode if it was active before the export
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
  }
  if (data.success) {
    console.log('PDF exported successfully to:', data.path);
    const fileName = data.path.split(/[\\/]/).pop();
    showNotification(i18n('notif.pdfExported') + fileName);
  } else {
    console.error('PDF export failed:', data.error);
    alert(i18n('alert.pdfFailed') + data.error);
  }
});

// Handle Word export result
ipcRenderer.on('word-export-result', (event, data) => {
  if (data.success) {
    console.log('Word document exported successfully to:', data.path);
    const fileName = data.path.split(/[\\/]/).pop();
    showNotification(i18n('notif.wordExported') + fileName);
  } else {
    console.error('Word export failed:', data.error);
    alert(i18n('alert.wordFailed') + data.error);
  }
});

// Toggle edit mode
toggleEditBtn.addEventListener('click', async () => {
  fileMenu.classList.remove('visible');
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm(i18n('confirm.unsavedExit'))) {
      return;
    }
  }

  isEditMode = !isEditMode;

  if (isEditMode) {
    // If showing translation, flush pending note translations and switch to original
    if (isShowingTranslation) {
      await flushPendingNoteTranslations();
      isShowingTranslation = false;
      updateToolsMenuState();
      renderMarkdown(originalMarkdown);
    }
    // Enter edit mode
    contentWrapper.classList.add('split-view');
    markdownEditor.value = originalMarkdown;
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
    toggleEditBtn.style.background = 'var(--primary-color)';
    toggleEditBtn.style.color = '#ffffff';
  } else {
    // Exit edit mode
    contentWrapper.classList.remove('split-view');
    toggleEditBtn.style.background = '';
    toggleEditBtn.style.color = '';
    clearTimeout(previewDebounceTimer);

    // Resume file tracking when exiting edit mode (if it was paused)
    if (!isFileTrackingActive && currentFilePath) {
      ipcRenderer.send('resume-file-watching');
      isFileTrackingActive = true;
    }
  }
});

// Exit edit mode button (in editor header)
exitEditBtn.addEventListener('click', () => {
  if (isEditMode) toggleEditBtn.click();
});

// Tab key → insert 2 spaces (prevent focus change)
markdownEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const spaces = '  '; // 2 spaces
    markdownEditor.value = markdownEditor.value.substring(0, start) + spaces + markdownEditor.value.substring(end);
    markdownEditor.selectionStart = markdownEditor.selectionEnd = start + spaces.length;
    // Trigger input event for unsaved state tracking
    markdownEditor.dispatchEvent(new Event('input'));
  }
});

// Push to undo history on significant changes (debounced)
let historyDebounceTimer = null;
markdownEditor.addEventListener('input', () => {
  clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(() => {
    if (isEditMode) historyPush(markdownEditor.value);
  }, 800);
});

// Live preview with fast debounce
markdownEditor.addEventListener('input', () => {
  if (!isEditMode) return;

  const previousUnsavedState = hasUnsavedChanges;
  hasUnsavedChanges = (markdownEditor.value !== originalMarkdown);
  updateUnsavedIndicator();

  // Pause file tracking when unsaved changes appear
  if (!previousUnsavedState && hasUnsavedChanges) {
    ipcRenderer.send('pause-file-watching');
    isFileTrackingActive = false;
  }

  // Clear existing timer
  clearTimeout(previewDebounceTimer);

  // Set new timer for 3 seconds
  previewDebounceTimer = setTimeout(() => {
    renderMarkdown(markdownEditor.value);
  }, TIMING.previewDebounceDelay);
});

// Sync editor textarea content with originalMarkdown after external changes (e.g. delete operations)
function syncEditorWithStore() {
  if (isEditMode && markdownEditor.value !== originalMarkdown) {
    const cursorPos = markdownEditor.selectionStart;
    markdownEditor.value = originalMarkdown;
    // Restore cursor position (clamped to new length)
    const newPos = Math.min(cursorPos, originalMarkdown.length);
    markdownEditor.selectionStart = markdownEditor.selectionEnd = newPos;
  }
}

// If cursor is inside a fenced code block, return the position just after the closing ```
// Returns the original insertPos if cursor is not inside a code block
function skipPastCodeBlock(content, insertPos) {
  // Look backwards from insertPos to see if we're inside ``` ... ```
  const before = content.substring(0, insertPos);
  const fenceOpenRegex = /```[\w]*\n/g;
  let lastFenceOpen = -1;
  let m;
  while ((m = fenceOpenRegex.exec(before)) !== null) {
    lastFenceOpen = m.index + m[0].length;
  }
  if (lastFenceOpen === -1) return insertPos; // not inside any fence

  // Count ``` closings between lastFenceOpen and insertPos
  const between = before.substring(lastFenceOpen);
  const closeCount = (between.match(/```/g) || []).length;
  if (closeCount % 2 === 0) {
    // Even number of closes → we're inside an open block
    // Find the closing ``` after insertPos
    const closeIdx = content.indexOf('```', insertPos);
    if (closeIdx !== -1) {
      // Position after the closing ``` and its newline
      const afterClose = closeIdx + 3;
      return content[afterClose] === '\n' ? afterClose + 1 : afterClose;
    }
  }
  return insertPos;
}

// Save file
function saveMarkdownFile() {
  if (!currentFilePath) {
    alert(i18n('alert.noFileOpen'));
    return;
  }

  const content = markdownEditor.value;
  ipcRenderer.send('save-markdown-file', {
    filePath: currentFilePath,
    content: content
  });
}

// Save button click
saveButton.addEventListener('click', saveMarkdownFile);

// Ctrl+Z (Undo) and Ctrl+Y (Redo) shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    historyUndo();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    historyRedo();
  }
});

// Note: Ctrl+Shift+O is intercepted by main.js (before-input-event) and forwarded
// as 'toggle-corporate-mode' IPC — handled above at ipcRenderer.on('toggle-corporate-mode')

// Ctrl+S keyboard shortcut
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditMode) {
    e.preventDefault();
    saveMarkdownFile();
  }
});

// Ctrl+R keyboard shortcut for refresh
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    if (currentFilePath) {
      // Check for unsaved changes
      if (isEditMode && hasUnsavedChanges) {
        if (confirm(i18n('confirm.unsavedRefresh'))) {
          reloadCurrentFile();
        }
      } else {
        reloadCurrentFile();
      }
    }
  }
});

// Handle save result
ipcRenderer.on('save-markdown-result', (event, data) => {
  if (data.success) {
    originalMarkdown = markdownEditor.value;
    invalidateTranslationCache();
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
    console.log('File saved successfully');

    // Resume file tracking after save
    if (!isFileTrackingActive) {
      ipcRenderer.send('resume-file-watching');
      isFileTrackingActive = true;
    }
  } else {
    console.error('Save failed:', data.error);
    alert(i18n('alert.saveFailed') + data.error);
  }
});

// Update unsaved indicator
function updateUnsavedIndicator() {
  if (hasUnsavedChanges) {
    unsavedIndicator.style.display = 'inline';
  } else {
    unsavedIndicator.style.display = 'none';
  }
}

// ============================================
// RECENT FILES MANAGEMENT
// ============================================

function getRecentFiles() {
  try {
    const recent = localStorage.getItem('recentFiles');
    return recent ? JSON.parse(recent) : [];
  } catch (e) {
    console.error('Error loading recent files:', e);
    return [];
  }
}

function saveRecentFile(filePath) {
  try {
    let recentFiles = getRecentFiles();

    // Remove if already exists
    recentFiles = recentFiles.filter(f => f.path !== filePath);

    // Add to beginning
    recentFiles.unshift({
      path: filePath,
      name: filePath.split(/[\\/]/).pop(),
      timestamp: Date.now()
    });

    // Keep only max recent files
    recentFiles = recentFiles.slice(0, STORAGE.maxRecentFiles);

    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
  } catch (e) {
    console.error('Error saving recent file:', e);
  }
}

function updateFileMenuRecent() {
  const recentFiles = getRecentFiles();

  if (recentFiles.length === 0) {
    fileMenuRecent.innerHTML = '<div class="tools-menu-recent-empty" data-i18n="noRecentFiles">' + i18n('noRecentFiles') + '</div>';
    return;
  }

  fileMenuRecent.innerHTML = '';

  recentFiles.forEach(file => {
    const item = document.createElement('div');
    item.className = 'tools-menu-recent-item';
    item.innerHTML = `
      <span class="tools-menu-recent-name">${file.name}</span>
      <span class="tools-menu-recent-path">${file.path}</span>
    `;

    item.addEventListener('click', () => {
      // Check for unsaved changes before opening
      if (isEditMode && hasUnsavedChanges) {
        if (!confirm(i18n('confirm.unsavedOpenFile', {name: file.name}))) {
          return;
        }
      }
      ipcRenderer.send('open-file-path', file.path);
      fileMenu.classList.remove('visible');
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showRecentContextMenu(e.clientX, e.clientY, file.path);
    });

    fileMenuRecent.appendChild(item);
  });
}

// Search functionality
let searchMatches = [];
let currentMatchIndex = -1;

function clearSearchHighlights() {
  const highlights = viewer.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCounter();
}

function highlightSearchTerm(searchTerm) {
  if (!searchTerm || searchTerm.length < 2) {
    clearSearchHighlights();
    return;
  }

  clearSearchHighlights();

  const textNodes = [];
  const walker = document.createTreeWalker(
    viewer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style, svg, mermaid, omniware, and already highlighted nodes
        if (node.parentNode.tagName === 'SCRIPT' ||
            node.parentNode.tagName === 'STYLE' ||
            node.parentNode.tagName === 'SVG' ||
            node.parentNode.closest('.mermaid') ||
            node.parentNode.closest('svg') ||
            node.parentNode.closest('.omniware-rendered') ||
            node.parentNode.classList?.contains('search-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  const searchRegex = new RegExp(escapeRegex(searchTerm), 'gi');

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [...text.matchAll(searchRegex)];

    if (matches.length > 0) {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(match => {
        // Add text before match
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        // Add highlighted match
        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = match[0];
        fragment.appendChild(span);
        searchMatches.push(span);

        lastIndex = match.index + match[0].length;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });

  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch();
  }

  updateSearchCounter();
}

function highlightCurrentMatch() {
  searchMatches.forEach((match, index) => {
    if (index === currentMatchIndex) {
      match.classList.add('current');
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      match.classList.remove('current');
    }
  });
}

function updateSearchCounter() {
  if (searchMatches.length > 0) {
    searchCounter.textContent = i18n('search.counter', {current: currentMatchIndex + 1, total: searchMatches.length});
    searchPrevBtn.disabled = false;
    searchNextBtn.disabled = false;
  } else {
    searchCounter.textContent = i18n('search.zero');
    searchPrevBtn.disabled = true;
    searchNextBtn.disabled = true;
  }
}

function nextMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
  highlightCurrentMatch();
  updateSearchCounter();
}

function previousMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = currentMatchIndex - 1;
  if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;
  highlightCurrentMatch();
  updateSearchCounter();
}

function toggleSearchPanel() {
  const isVisible = searchPanel.classList.toggle('visible');
  if (isVisible) {
    searchInput.focus();
    searchInput.select();
  } else {
    clearSearchHighlights();
    searchInput.value = '';
  }
}

// Search event listeners
searchInput.addEventListener('input', (e) => {
  highlightSearchTerm(e.target.value);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      previousMatch();
    } else {
      nextMatch();
    }
  } else if (e.key === 'Escape') {
    toggleSearchPanel();
  }
});

searchNextBtn.addEventListener('click', nextMatch);
searchPrevBtn.addEventListener('click', previousMatch);
searchCloseBtn.addEventListener('click', toggleSearchPanel);

// Index/TOC functionality
function buildTableOfContents() {
  const headers = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headers.length === 0) {
    indexList.innerHTML = '<div class="index-empty" data-i18n="noHeaders">' + i18n('noHeaders') + '</div>';
    return;
  }

  indexList.innerHTML = '';

  headers.forEach((header, index) => {
    // Add ID to header if it doesn't have one
    if (!header.id) {
      header.id = `header-${index}`;
    }

    const level = parseInt(header.tagName.substring(1));
    const item = document.createElement('div');
    item.className = `index-item level-${level}`;
    item.textContent = header.textContent;
    item.dataset.headerId = header.id;

    item.addEventListener('click', () => {
      const targetHeader = document.getElementById(header.id);
      if (targetHeader) {
        // Calculate the scroll position relative to contentWrapper
        const contentRect = contentWrapper.getBoundingClientRect();
        const headerRect = targetHeader.getBoundingClientRect();
        const scrollOffset = headerRect.top - contentRect.top + contentWrapper.scrollTop - 20; // 20px padding from top

        // Scroll the content wrapper to the header
        contentWrapper.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
        });

        // Update active state
        document.querySelectorAll('.index-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });

    indexList.appendChild(item);
  });
}

// Index panel toggle
toggleIndexBtn.addEventListener('click', () => {
  fileMenu.classList.remove('visible');
  indexPanel.classList.toggle('visible');
});

closeIndexBtn.addEventListener('click', () => {
  indexPanel.classList.remove('visible');
});

// Notes panel toggle
toggleNotesBtn.addEventListener('click', () => {
  fileMenu.classList.remove('visible');
  const willOpen = !notesPanel.classList.contains('visible');
  notesPanel.classList.toggle('visible');
  if (willOpen) updateNotesList();
});

closeNotesBtn.addEventListener('click', () => {
  notesPanel.classList.remove('visible');
  // Reset search state
  notesSearchBar.classList.remove('visible');
  notesSearchToggle.classList.remove('active');
  notesSearchInput.value = '';
});

function updateNotesList() {
  const allNotes = viewer.querySelectorAll('.noted-text[data-note-id], .noted-image[data-note-id], .note-label[data-note-id]');

  if (allNotes.length === 0) {
    notesList.innerHTML = '<div class="notes-empty" data-i18n="noNotes">' + i18n('noNotes') + '</div>';
    return;
  }

  // Sort by note ID (numeric)
  const sorted = Array.from(allNotes).sort((a, b) => {
    return parseInt(a.getAttribute('data-note-id') || '0') - parseInt(b.getAttribute('data-note-id') || '0');
  });

  notesList.innerHTML = '';

  sorted.forEach(noteEl => {
    const noteId = noteEl.getAttribute('data-note-id') || '';
    const title = noteEl.getAttribute('data-note-title') || '';
    const content = noteEl.getAttribute('data-note-content') || '';
    const color = extractNoteColor(noteEl);
    const isLabel = noteEl.classList.contains('note-label');
    const isImage = noteEl.classList.contains('noted-image');
    const type = isLabel ? 'Label' : isImage ? 'Image' : 'Text';

    const item = document.createElement('div');
    item.className = 'notes-item';
    item.dataset.noteId = noteId;
    item.dataset.noteTitle = title.toLowerCase();
    item.style.borderLeftColor = color;

    const escTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    item.innerHTML = `
      <div class="notes-item-header">
        <span class="notes-item-id">#${noteId}</span>
        <span class="notes-item-title" style="color:${color}">${escTitle || i18n('note')}</span>
      </div>
      ${escContent ? `<div class="notes-item-content">${escContent}</div>` : ''}
      <div class="notes-item-type">${type}</div>
    `;

    item.addEventListener('click', () => {
      // Scroll to note in viewer
      const target = viewer.querySelector(`[data-note-id="${noteId}"]`);
      if (!target) return;
      const noteRect = target.getBoundingClientRect();
      const wrapperRect = contentWrapper.getBoundingClientRect();
      const scrollTarget = contentWrapper.scrollTop + noteRect.top - wrapperRect.top - (wrapperRect.height / 2);
      contentWrapper.scrollTo({ top: scrollTarget, behavior: 'smooth' });

      // Highlight with pulse animation
      target.classList.add('note-highlight');
      setTimeout(() => target.classList.remove('note-highlight'), 4500);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showNotesPanelContextMenu(e.clientX, e.clientY, noteId);
    });

    notesList.appendChild(item);
  });

  // Re-apply active search filter if search bar is open
  if (notesSearchBar.classList.contains('visible') && notesSearchInput.value.trim()) {
    filterNotesList(notesSearchInput.value.trim());
  }
}

// Notes panel search
notesSearchToggle.addEventListener('click', () => {
  const isVisible = notesSearchBar.classList.contains('visible');
  notesSearchBar.classList.toggle('visible');
  notesSearchToggle.classList.toggle('active');
  if (!isVisible) {
    notesSearchInput.value = '';
    notesSearchInput.focus();
    // Reset filter
    notesList.querySelectorAll('.notes-item').forEach(item => {
      item.classList.remove('search-hidden', 'search-highlight');
    });
  } else {
    // Clear search on close
    notesSearchInput.value = '';
    notesList.querySelectorAll('.notes-item').forEach(item => {
      item.classList.remove('search-hidden', 'search-highlight');
    });
  }
});

notesSearchInput.addEventListener('input', () => {
  const query = notesSearchInput.value.trim();
  filterNotesList(query);
});

notesSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // Find first visible item and click it (scroll to note in viewer)
    const firstVisible = notesList.querySelector('.notes-item:not(.search-hidden)');
    if (firstVisible) firstVisible.click();
  } else if (e.key === 'Escape') {
    notesSearchToggle.click(); // Close search bar
  }
});

function filterNotesList(query) {
  const items = notesList.querySelectorAll('.notes-item');
  if (!query) {
    items.forEach(item => item.classList.remove('search-hidden', 'search-highlight'));
    return;
  }

  const searchLower = query.toLowerCase();
  const idMatch = query.match(/^#?(\d+)$/);
  let firstMatch = null;

  items.forEach(item => {
    const noteId = item.dataset.noteId || '';
    const noteTitle = item.dataset.noteTitle || '';
    let matches = false;

    if (idMatch) {
      matches = noteId === idMatch[1];
    }
    if (!matches) {
      matches = noteTitle.includes(searchLower) || noteId.includes(searchLower);
    }

    if (matches) {
      item.classList.remove('search-hidden');
      item.classList.add('search-highlight');
      if (!firstMatch) firstMatch = item;
    } else {
      item.classList.add('search-hidden');
      item.classList.remove('search-highlight');
    }
  });

  // Scroll to first match in the notes list
  if (firstMatch) {
    firstMatch.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'f':
      case 'F':
        e.preventDefault();
        toggleSearchPanel();
        break;
      case '+':
      case '=':
        e.preventDefault();
        if (zoomLevel < ZOOM_CONFIG.max) {
          zoomLevel += ZOOM_CONFIG.step;
          updateZoom();
        }
        break;
      case '-':
      case '_':
        e.preventDefault();
        if (zoomLevel > ZOOM_CONFIG.min) {
          zoomLevel -= ZOOM_CONFIG.step;
          updateZoom();
        }
        break;
      case '0':
        e.preventDefault();
        zoomLevel = ZOOM_CONFIG.level;
        updateZoom();
        break;
    }
  }
});

// Mouse wheel zoom
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();

    // Negative deltaY means scrolling up (zoom in)
    // Positive deltaY means scrolling down (zoom out)
    if (e.deltaY < 0) {
      // Zoom in
      if (zoomLevel < ZOOM_CONFIG.max) {
        zoomLevel += ZOOM_CONFIG.step;
        updateZoom();
      }
    } else if (e.deltaY > 0) {
      // Zoom out
      if (zoomLevel > ZOOM_CONFIG.min) {
        zoomLevel -= ZOOM_CONFIG.step;
        updateZoom();
      }
    }
  }
}, { passive: false });

// ============================================
// TRANSLATION SYSTEM (Batch + Parallel)
// ============================================

async function googleTranslate(text, targetLang) {
  if (!text || !text.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation API error: ${response.status}`);
  const data = await response.json();
  const segments = data[0];
  if (!segments || !Array.isArray(segments)) return text; // API returned unexpected format
  return segments.map(s => (s && s[0]) || '').join('');
}

// Parallel batch translator — sends up to CONCURRENCY requests at once.
// Per-piece fallback: if a single piece fails, it stays in the original language
// rather than failing the entire translation.
async function batchGoogleTranslate(pieces, targetLang) {
  const CONCURRENCY = 6;
  const results = new Array(pieces.length);

  const todo = [];
  pieces.forEach((t, i) => {
    if (t && t.trim()) {
      todo.push(i);
    } else {
      results[i] = t || '';
    }
  });

  for (let start = 0; start < todo.length; start += CONCURRENCY) {
    const batch = todo.slice(start, start + CONCURRENCY);
    await Promise.all(batch.map(async (i) => {
      try {
        results[i] = await googleTranslate(pieces[i], targetLang);
      } catch (e) {
        console.warn('Piece translation failed, keeping original:', pieces[i]?.substring(0, 40), e.message);
        results[i] = pieces[i]; // fallback: keep original text for this piece
      }
    }));
  }

  return results;
}

function parseMarkdownForTranslation(md) {
  const segments = [];
  let i = 0;
  const len = md.length;

  while (i < len) {
    // Fenced code block
    if (md.startsWith('```', i)) {
      const endFence = md.indexOf('```', i + 3);
      if (endFence !== -1) {
        const block = md.slice(i, endFence + 3);
        segments.push({ type: 'preserve', text: block });
        i = endFence + 3;
        continue;
      }
    }

    // Note spans: noted-text, noted-image, note-label — translate their data attributes
    const noteSpanMatch = md.slice(i).match(/^<span\s+class="(?:noted-text|noted-image|note-label)"[^>]*>[\s\S]*?<\/span>/);
    if (noteSpanMatch) {
      segments.push({ type: 'note-span', text: noteSpanMatch[0] });
      i += noteSpanMatch[0].length;
      continue;
    }

    // Inline code
    if (md[i] === '`' && !md.startsWith('```', i)) {
      const endTick = md.indexOf('`', i + 1);
      if (endTick !== -1) {
        segments.push({ type: 'preserve', text: md.slice(i, endTick + 1) });
        i = endTick + 1;
        continue;
      }
    }

    // Image: ![alt](url)
    const imgMatch = md.slice(i).match(/^!\[[^\]]*\]\([^)]*\)/);
    if (imgMatch) {
      segments.push({ type: 'preserve', text: imgMatch[0] });
      i += imgMatch[0].length;
      continue;
    }

    // Link: [text](url) — preserve URL, translate text
    const linkMatch = md.slice(i).match(/^\[([^\]]*)\]\(([^)]*)\)/);
    if (linkMatch) {
      segments.push({ type: 'link', text: linkMatch[0], linkText: linkMatch[1], linkUrl: linkMatch[2] });
      i += linkMatch[0].length;
      continue;
    }

    // HTML block/tag — preserve entirely
    const htmlMatch = md.slice(i).match(/^<[^>]+>/);
    if (htmlMatch) {
      segments.push({ type: 'preserve', text: htmlMatch[0] });
      i += htmlMatch[0].length;
      continue;
    }

    // Table separator row: |---|---|
    const tableSepMatch = md.slice(i).match(/^(\|[\s:]*-{2,}[\s:]*)+\|?\s*(\n|$)/);
    if (tableSepMatch) {
      segments.push({ type: 'preserve', text: tableSepMatch[0] });
      i += tableSepMatch[0].length;
      continue;
    }

    // Regular text — collect until next special pattern
    let end = i + 1;
    while (end < len) {
      if (md[end] === '`' || md[end] === '<' || md[end] === '!' || md[end] === '[') break;
      if (md.startsWith('<span', end)) break;
      end++;
    }
    segments.push({ type: 'translate', text: md.slice(i, end) });
    i = end;
  }

  return segments;
}

async function translateMarkdownDocument(md, targetLang) {
  const segments = parseMarkdownForTranslation(md);

  // Phase 1: Collect all translatable pieces into a flat array
  const pieces = [];
  const blueprints = [];

  for (const seg of segments) {
    if (seg.type === 'preserve') {
      blueprints.push({ type: 'literal', text: seg.text });
    }
    else if (seg.type === 'note-span') {
      const bp = { type: 'note-span', html: seg.text, titleIdx: -1, contentIdx: -1, innerIdx: -1 };
      const titleMatch = seg.text.match(/data-note-title="([^"]*)"/);
      if (titleMatch && titleMatch[1]) { bp.titleIdx = pieces.length; pieces.push(titleMatch[1]); }
      const contentMatch = seg.text.match(/data-note-content="([^"]*)"/);
      if (contentMatch && contentMatch[1]) { bp.contentIdx = pieces.length; pieces.push(contentMatch[1]); }
      const innerMatch = seg.text.match(/>([^<]+)<\/span>$/);
      if (innerMatch && innerMatch[1]) { bp.innerIdx = pieces.length; pieces.push(innerMatch[1]); }
      blueprints.push(bp);
    }
    else if (seg.type === 'link') {
      blueprints.push({ type: 'link', url: seg.linkUrl, textIdx: pieces.length });
      pieces.push(seg.linkText);
    }
    else if (seg.type === 'translate') {
      const lines = seg.text.split('\n');
      const lineInfos = [];
      for (const line of lines) {
        if (!line.trim()) { lineInfos.push({ empty: true, original: line }); continue; }
        const tableSep = line.match(/^(\|[\s:]*-{2,}[\s:]*)+\|?\s*$/);
        if (tableSep) { lineInfos.push({ empty: true, original: line }); continue; }
        const pm = line.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*|\|\s*))(.*)/);
        if (pm && pm[1].trimStart().startsWith('|')) {
          // Table row — each cell is a separate piece
          const cells = line.split('|');
          const cellInfos = cells.map(cell => {
            if (cell.trim()) {
              const ci = { hasContent: true, idx: pieces.length };
              pieces.push(cell.trim());
              return ci;
            }
            return { hasContent: false, original: cell };
          });
          lineInfos.push({ isTable: true, cells: cellInfos });
        } else if (pm && pm[2].trim()) {
          const isHeading = /^#{1,6}\s+$/.test(pm[1]);
          lineInfos.push({ prefix: pm[1], idx: pieces.length, isHeading, original: isHeading ? pm[2] : undefined });
          pieces.push(pm[2]);
        } else if (line.trim()) {
          lineInfos.push({ prefix: '', idx: pieces.length });
          pieces.push(line);
        } else {
          lineInfos.push({ empty: true, original: line });
        }
      }
      blueprints.push({ type: 'text', lineInfos });
    }
    else {
      blueprints.push({ type: 'literal', text: seg.text });
    }
  }

  // Phase 2: Check piece cache, only translate uncached pieces
  const translated = new Array(pieces.length);
  const uncachedIndices = [];
  const uncachedTexts = [];

  for (let i = 0; i < pieces.length; i++) {
    const text = pieces[i];
    if (!text || !text.trim()) {
      translated[i] = text || '';
      continue;
    }
    const cached = translationPieceCache.get(text);
    if (cached !== undefined) {
      translated[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(text);
    }
  }

  if (uncachedTexts.length > 0) {
    const newTranslations = await batchGoogleTranslate(uncachedTexts, targetLang);
    for (let j = 0; j < uncachedIndices.length; j++) {
      const pi = uncachedIndices[j];
      translated[pi] = newTranslations[j];
      translationPieceCache.set(pieces[pi], newTranslations[j]);
    }
  }

  // Phase 3: Reconstruct document from blueprints
  const result = [];
  for (const bp of blueprints) {
    switch (bp.type) {
      case 'literal':
        result.push(bp.text);
        break;
      case 'note-span': {
        let html = bp.html;
        if (bp.titleIdx >= 0) html = html.replace(/data-note-title="[^"]*"/, `data-note-title="${translated[bp.titleIdx].replace(/"/g, '&quot;')}"`);
        if (bp.contentIdx >= 0) html = html.replace(/data-note-content="[^"]*"/, `data-note-content="${translated[bp.contentIdx].replace(/"/g, '&quot;')}"`);
        if (bp.innerIdx >= 0) html = html.replace(/>([^<]+)<\/span>$/, `>${translated[bp.innerIdx]}</span>`);
        result.push(html);
        break;
      }
      case 'link':
        result.push(`[${translated[bp.textIdx]}](${bp.url})`);
        break;
      case 'text':
        result.push(bp.lineInfos.map(li => {
          if (li.empty) return li.original;
          if (li.isTable) return li.cells.map(c => c.hasContent ? ' ' + translated[c.idx] + ' ' : c.original).join('|');
          if (li.isHeading) return li.prefix + translated[li.idx];
          return li.prefix + translated[li.idx];
        }).join('\n'));
        break;
    }
  }

  return result.join('');
}

// ============================================
// RENDER OPTIMIZATION
// ============================================

let renderGeneration = 0; // Stale render cancellation counter
const mermaidSvgCache = new Map(); // Cache: mermaid source → rendered SVG innerHTML (cleared on theme change)

// Detect render mode based on content diff
function detectRenderMode(oldContent, newContent) {
  if (!oldContent) return 'full';

  // Check if mermaid/omniware/slider blocks changed
  const hasMermaid = /```mermaid/i.test(newContent) || /```mermaid/i.test(oldContent);
  const hasOmniware = /```omniware/i.test(newContent) || /```omniware/i.test(oldContent);
  const hasSlider = /<!--\s*slider/i.test(newContent) || /<!--\s*slider/i.test(oldContent);

  if (!hasMermaid && !hasOmniware && !hasSlider) {
    // Only text/format changes — check if images changed
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const oldImgs = [...oldContent.matchAll(imgRegex)].map(m => m[2]).join(',');
    const newImgs = [...newContent.matchAll(imgRegex)].map(m => m[2]).join(',');
    if (oldImgs === newImgs) {
      return 'light-format'; // Only text changed
    }
    return 'light-media'; // Images changed
  }
  return 'full';
}

// ---- Incremental DOM patching helpers ----

// Lightweight hash for block identity (FNV-inspired)
function _blockHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// Get block hash from an element, looking inside known wrapper divs if needed
function _getBlockHash(el) {
  if (el.dataset && el.dataset.blockHash) return el.dataset.blockHash;
  // code-block-container / table-container wrap the real element as first non-button child
  if (el.classList && (el.classList.contains('code-block-container') || el.classList.contains('table-container'))) {
    for (const child of el.children) {
      if (child.tagName !== 'BUTTON' && child.dataset && child.dataset.blockHash) return child.dataset.blockHash;
    }
  }
  return null;
}

// Patch viewer's top-level children in-place — only replace nodes that actually changed.
// Unchanged nodes (same hash) are left untouched, preserving scroll position and event listeners.
function patchViewerDOM(newHtml) {
  const temp = document.createElement('div');
  temp.innerHTML = newHtml;

  // Stamp each new element with a hash of its content (computed before setting the attr)
  const newEls = Array.from(temp.children);
  newEls.forEach(el => { el.dataset.blockHash = _blockHash(el.outerHTML); });

  const oldEls = Array.from(viewer.children);
  const maxLen = Math.max(newEls.length, oldEls.length);

  for (let i = 0; i < maxLen; i++) {
    const nEl = newEls[i];
    const oEl = oldEls[i];

    if (!nEl) { oEl.remove(); continue; }
    if (!oEl) { viewer.appendChild(nEl); continue; }

    // Mermaid: old element already has rendered SVG — compare source only
    if (nEl.classList.contains('mermaid') && oEl.classList.contains('mermaid')) {
      const nSrc = nEl.dataset.mermaidSrc || nEl.textContent.trim();
      const oSrc = oEl.dataset.mermaidSrc || '';
      if (nSrc !== oSrc) viewer.replaceChild(nEl, oEl);
      continue; // keep existing SVG if same source
    }

    // General: compare content hashes
    const nHash = nEl.dataset.blockHash;
    const oHash = _getBlockHash(oEl);
    if (nHash && oHash && nHash === oHash) continue; // identical — skip

    viewer.replaceChild(nEl, oEl);
  }
}

// ---- End incremental DOM patching ----

// Light-format render: skip mermaid/omniware/prism, patch only changed DOM nodes
function renderLightFormat(content, generation) {
  if (generation !== renderGeneration) return;

  content = removeBOM(content);

  // Extract and placeholder special blocks (same as full render)
  const mermaidBlocks = [];
  content = content.replace(/```mermaid[\r\n]+([\s\S]*?)```/g, (match, code) => {
    const ph = `MERMAID_PH_${mermaidBlocks.length}`;
    mermaidBlocks.push({ ph, code: code.trim() });
    return ph;
  });

  let html = marked.parse(content);

  // Restore mermaid placeholders — patchViewerDOM will keep existing SVGs for same source
  mermaidBlocks.forEach(({ ph, code }) => {
    const escapedSrc = code.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    html = html.replace(ph, `<pre class="mermaid" data-mermaid-src="${escapedSrc}">${code}</pre>`);
  });

  // Protect data URIs
  const dataUriStore = [];
  html = html.replace(/<img([^>]*?)src\s*=\s*"(data:image\/[^"]+)"([^>]*?)>/gi, (match, before, dataUri, after) => {
    const idx = dataUriStore.length;
    dataUriStore.push(dataUri);
    return `<img${before}src="https://data-uri-placeholder.local/${idx}"${after}>`;
  });

  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: ['target', 'style', 'class', 'id', 'data-note-id', 'data-note-title', 'data-note-content', 'data-note-color']
  });

  dataUriStore.forEach((uri, idx) => {
    html = html.replace(`https://data-uri-placeholder.local/${idx}`, uri);
  });

  if (generation !== renderGeneration) return;

  patchViewerDOM(html);
  applyNoteStyles();
  addTableMaximizeButtons();
  initImageZoom();
  buildTableOfContents();
  updateShowNotesToggleVisibility();
  updateNotesList();
  highlightNewElements();
  addCodeBlockCopyButtons();
}

// Highlight only elements not yet processed by Prism
function highlightNewElements() {
  if (typeof Prism === 'undefined') return;
  viewer.querySelectorAll('pre code:not(.prism-highlighted)').forEach(el => {
    Prism.highlightElement(el);
    el.classList.add('prism-highlighted');
  });
}

// Smart render dispatcher — chooses mode based on content diff
let _lastRenderedContent = null;
async function renderMarkdown(content, forceMode = null) {
  const generation = ++renderGeneration;
  const mode = forceMode || detectRenderMode(_lastRenderedContent, content);

  if (mode === 'light-format' && _lastRenderedContent !== null) {
    _lastRenderedContent = content;
    renderLightFormat(content, generation); // sync — no await needed
    return;
  }

  _lastRenderedContent = content;
  return renderMarkdownFull(content, generation);
}

// Full render pipeline
async function renderMarkdownFull(content, generation) {
  // Show loading screen
  showLoadingScreen();

  // Give browser time to render the loading screen before heavy processing
  await new Promise(resolve => setTimeout(resolve, 10));

  try {
    // Remove BOM (Byte Order Mark) if present
    content = removeBOM(content);

    // Extract image slider blocks and replace with placeholders
    const sliderBlocks = [];
    let sliderIndex = 0;
    content = content.replace(/<!--\s*slider-start\s*-->([\s\S]*?)<!--\s*slider-end\s*-->/g, (match, inner) => {
      const placeholder = `SLIDER_PLACEHOLDER_${sliderIndex}`;
      // Extract images from the inner block
      const images = [];
      const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(inner)) !== null) {
        images.push({ alt: imgMatch[1], src: imgMatch[2] });
      }
      if (images.length > 0) {
        sliderBlocks.push({ placeholder, images });
        sliderIndex++;
        return placeholder;
      }
      return match; // no images found — leave unchanged
    });

    // First, extract mermaid blocks and replace with placeholders
    const mermaidBlocks = [];
    let mermaidIndex = 0;

  // Replace mermaid code blocks with placeholders (handle both \n and \r\n)
  content = content.replace(/```mermaid[\r\n]+([\s\S]*?)```/g, (match, code) => {
    const placeholder = `MERMAID_PLACEHOLDER_${mermaidIndex}`;
    mermaidBlocks.push({ placeholder, code: code.trim() });
    mermaidIndex++;
    return placeholder;
  });

    // Extract omniware blocks and replace with placeholders
    const omniwareBlocks = [];
    let omniwareIndex = 0;
    content = content.replace(/```omniware[\r\n]+([\s\S]*?)```/g, (match, code) => {
      const placeholder = `OMNIWARE_PLACEHOLDER_${omniwareIndex}`;
      omniwareBlocks.push({ placeholder, code: code.trim() });
      omniwareIndex++;
      return placeholder;
    });

  // Parse markdown with marked (allows HTML)
  let html = marked.parse(content);

  // Protect data URI images from DOMPurify (it strips data: URIs by default)
  const dataUriStore = [];
  html = html.replace(/<img([^>]*?)src\s*=\s*"(data:image\/[^"]+)"([^>]*?)>/gi, (match, before, dataUri, after) => {
    const idx = dataUriStore.length;
    dataUriStore.push(dataUri);
    return `<img${before}src="https://data-uri-placeholder.local/${idx}"${after}>`;
  });

  // Sanitize HTML but allow most tags for rich content
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: ['target', 'style', 'class', 'id', 'data-note-id', 'data-note-title', 'data-note-content', 'data-note-color']
  });

  // Restore data URI images after sanitization
  dataUriStore.forEach((uri, idx) => {
    html = html.replace(`https://data-uri-placeholder.local/${idx}`, uri);
  });

  // Replace slider placeholders with slider HTML
  sliderBlocks.forEach(({ placeholder, images }) => {
    const zoomBtnHtml = `<button class="img-zoom-btn" title="Zoom"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>`;
    const slidesHtml = images.map((img, i) =>
      `<div class="slider-slide${i === 0 ? ' active' : ''}" data-index="${i}">
        <img src="${img.src}" alt="${img.alt || ''}">
        ${zoomBtnHtml}
      </div>`
    ).join('');
    const dotsHtml = images.map((_, i) =>
      `<span class="slider-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`
    ).join('');
    const sliderHtml = `<div class="image-slider" data-slider-initialized="false" data-slider-total="${images.length}" data-slider-current="0">
      <div class="slider-track">${slidesHtml}</div>
      <button class="slider-btn slider-prev" title="Previous">&#8249;</button>
      <button class="slider-btn slider-next" title="Next">&#8250;</button>
      <div class="slider-footer">
        <div class="slider-dots">${dotsHtml}</div>
        <span class="slider-counter">1 / ${images.length}</span>
      </div>
    </div>`;
    // Use a regex to handle the placeholder that may be wrapped in <p> by marked
    html = html.replace(new RegExp(`<p>${placeholder}</p>|${placeholder}`), sliderHtml);
  });

  // Replace placeholders with mermaid divs
  mermaidBlocks.forEach(({ placeholder, code }) => {
    const escapedSrc = code.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const mermaidDiv = `<pre class="mermaid" data-mermaid-src="${escapedSrc}">${code}</pre>`;
    html = html.replace(placeholder, mermaidDiv);
  });

    // Replace placeholders with rendered omniware wireframes
    omniwareBlocks.forEach(({ placeholder, code }) => {
      try {
        const renderedHtml = OmniWare.toHTML(code);
        const escapedDsl = code.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const omniwareDiv = `<div class="omniware-rendered" data-omniware-dsl="${escapedDsl}">${renderedHtml}</div>`;
        html = html.replace(placeholder, omniwareDiv);
      } catch (err) {
        const errorDiv = `<div style="color: red; padding: 20px; background: #ffe6e6; border: 1px solid #ff0000; border-radius: 4px;">
          <strong>OmniWare Rendering Error:</strong><br>${err.message}
        </div>`;
        html = html.replace(placeholder, errorDiv);
      }
    });

  // Patch only changed DOM nodes — preserves scroll, avoids full relayout
  patchViewerDOM(html);

  // Apply note styles immediately after DOM insertion (before async callbacks)
  applyNoteStyles();

  // Re-run mermaid on the new content, reusing cached SVGs for unchanged diagrams
  try {
    const mermaidElements = viewer.querySelectorAll('.mermaid');
    if (mermaidElements.length > 0) {
      const toRender = [];

      mermaidElements.forEach((el, index) => {
        // Use data-mermaid-src when available (kept elements already have SVG in textContent)
        const src = el.dataset.mermaidSrc || el.textContent.trim();
        el.dataset.mermaidSrc = src;

        if (mermaidSvgCache.has(src)) {
          // Restore cached SVG — no mermaid.run() needed for this element
          el.innerHTML = mermaidSvgCache.get(src);
          el.setAttribute('data-processed', 'true');
        } else {
          el.removeAttribute('data-processed');
          el.id = `mermaid-${Date.now()}-${index}`;
          toRender.push(el);
        }
      });

      // Only render new/changed diagrams
      if (toRender.length > 0) {
        await mermaid.run({ nodes: toRender, suppressErrors: false });
        // Store newly rendered SVGs in cache
        toRender.forEach(el => {
          if (el.querySelector('svg')) {
            mermaidSvgCache.set(el.dataset.mermaidSrc, el.innerHTML);
          }
        });
      }

      // Add maximize buttons to all diagrams (only if not already wrapped in a container)
      mermaidElements.forEach((el) => {
        const svg = el.querySelector('svg');
        if (svg && !el.closest('.mermaid-container')) {
          // Wrap in container
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          el.parentNode.insertBefore(container, el);
          container.appendChild(el);

          // Add maximize button
          const maxBtn = document.createElement('button');
          maxBtn.className = 'mermaid-maximize-btn';
          maxBtn.title = 'Open in new window';
          maxBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
            </svg>
          `;

          maxBtn.addEventListener('click', () => {
            const svgContent = svg.outerHTML;
            const isDarkMode = document.body.classList.contains('dark-mode');
            ipcRenderer.send('open-mermaid-popup', { svgContent, isDarkMode });
          });

          container.appendChild(maxBtn);
        }
      });
    }
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    // Show error in the diagram location
    const mermaidElements = viewer.querySelectorAll('.mermaid');
    mermaidElements.forEach(el => {
      if (!el.querySelector('svg')) {
        el.innerHTML = `<div style="color: red; padding: 20px; background: #ffe6e6; border: 1px solid #ff0000; border-radius: 4px;">
          <strong>Mermaid Rendering Error:</strong><br>${error.message}
        </div>`;
      }
    });
  }

    // Post-process OmniWare wireframes
    const omniwareElements = viewer.querySelectorAll('.omniware-rendered');
    if (omniwareElements.length > 0) {
      // Ensure OmniWare styles are injected
      if (!document.getElementById('omniware-styles')) {
        const tempDiv = document.createElement('div');
        OmniWare.render('', tempDiv);
      }

      // Apply dark mode if active
      const isDarkMode = document.body.classList.contains('dark-mode');
      updateOmniWareDarkMode(isDarkMode);

      // Wrap each in container and add maximize button
      omniwareElements.forEach((el) => {
        const container = document.createElement('div');
        container.className = 'omniware-container';
        el.parentNode.insertBefore(container, el);
        container.appendChild(el);

        const maxBtn = document.createElement('button');
        maxBtn.className = 'omniware-maximize-btn';
        maxBtn.title = 'Open wireframe in new window';
        maxBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
          </svg>
        `;

        maxBtn.addEventListener('click', () => {
          const dslCode = el.getAttribute('data-omniware-dsl')
            .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          const isDark = document.body.classList.contains('dark-mode');
          ipcRenderer.send('open-omniware-popup', { dslCode, isDarkMode: isDark });
        });

        container.appendChild(maxBtn);
      });
    }

    // Add maximize buttons to tables
    addTableMaximizeButtons();

    // Initialize image sliders (must run before initImageZoom so slider imgs are wrapped)
    initSliders();

    // Initialize image zoom buttons (after sliders so .slider-slide imgs are excluded)
    initImageZoom();

    // Build table of contents
    buildTableOfContents();

    // Scroll to top
    viewer.parentElement.scrollTop = 0;

    // Apply syntax highlighting with PrismJS (asynchronously to avoid blocking)
    if (typeof Prism !== 'undefined') {
      // Use requestIdleCallback for non-blocking syntax highlighting
      const highlightCallback = window.requestIdleCallback || window.setTimeout;
      highlightCallback(() => {
        if (generation !== renderGeneration) { hideLoadingScreen(); return; } // stale check
        Prism.highlightAll();
        // Mark all as highlighted to support targeted highlighting
        viewer.querySelectorAll('pre code').forEach(el => el.classList.add('prism-highlighted'));
        // Add copy buttons to code blocks after syntax highlighting
        addCodeBlockCopyButtons();
        // Hide loading screen after syntax highlighting is done
        hideLoadingScreen();
        if (notesPanel.classList.contains('visible')) updateNotesList();
        updateShowNotesToggleVisibility();
        applyNoteStyles();
      });
    } else {
      // Add copy buttons even without Prism
      addCodeBlockCopyButtons();
      // Hide loading screen if no syntax highlighting needed
      hideLoadingScreen();
      if (notesPanel.classList.contains('visible')) updateNotesList();
      updateShowNotesToggleVisibility();
      applyNoteStyles();
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    viewer.innerHTML = `<div style="color: red; padding: 20px;">
      <strong>Error rendering markdown:</strong><br>${error.message}
    </div>`;
    hideLoadingScreen();
  }
}

// ============================================
// IMAGE SLIDER
// ============================================

function initSliders() {
  viewer.querySelectorAll('.image-slider[data-slider-initialized="false"]').forEach(slider => {
    slider.setAttribute('data-slider-initialized', 'true');

    const slides = slider.querySelectorAll('.slider-slide');
    const dots = slider.querySelectorAll('.slider-dot');
    const counter = slider.querySelector('.slider-counter');
    const prevBtn = slider.querySelector('.slider-prev');
    const nextBtn = slider.querySelector('.slider-next');
    const total = slides.length;
    let current = 0;
    let autoPlayTimer = null;

    function goTo(idx) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = ((idx % total) + total) % total;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      slider.setAttribute('data-slider-current', current);
      if (counter) counter.textContent = `${current + 1} / ${total}`;
    }

    function startAutoPlay() {
      stopAutoPlay();
      if (total > 1) autoPlayTimer = setInterval(() => goTo(current + 1), 5000);
    }

    function stopAutoPlay() {
      if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
    }

    prevBtn && prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(current - 1);
      startAutoPlay();
    });

    nextBtn && nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(current + 1);
      startAutoPlay();
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(i);
        startAutoPlay();
      });
    });

    // Pause on hover
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);

    // Per-slide zoom button — open image in popup (same as regular image zoom)
    slides.forEach(slide => {
      const zoomBtn = slide.querySelector('.img-zoom-btn');
      if (!zoomBtn) return;
      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const img = slide.querySelector('img');
        if (img) {
          ipcRenderer.send('open-image-popup', {
            src: img.src,
            alt: img.alt || '',
            isDarkMode: document.body.classList.contains('dark-mode')
          });
        }
      });
    });

    startAutoPlay();
  });
}

// Add maximize buttons to tables for popup view
function addTableMaximizeButtons() {
  const tables = viewer.querySelectorAll('.markdown-body table, #viewer table');

  // Use DocumentFragment to batch DOM operations
  const fragment = document.createDocumentFragment();
  const updates = [];

  tables.forEach((table) => {
    // Skip if already wrapped
    if (table.parentNode.classList?.contains('table-container')) {
      return;
    }

    // Check column count and apply compact styling if needed
    const firstRow = table.querySelector('thead tr, tr:first-child');
    if (firstRow) {
      const columnCount = firstRow.querySelectorAll('th, td').length;
      if (columnCount > 5) {
        table.classList.add('compact-table');
      }
    }

    // Create container and button
    const container = document.createElement('div');
    container.className = 'table-container';

    const maxBtn = document.createElement('button');
    maxBtn.className = 'table-maximize-btn';
    maxBtn.title = 'Open in interactive popup';
    maxBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
      </svg>
    `;

    maxBtn.addEventListener('click', () => {
      // Extract table data
      const tableData = extractTableData(table);
      const isDarkMode = document.body.classList.contains('dark-mode');
      ipcRenderer.send('open-table-popup', { tableData, isDarkMode });
    });

    // Store for batch insertion
    updates.push({ table, container, maxBtn });
  });

  // Batch insert all containers and buttons
  updates.forEach(({ table, container, maxBtn }) => {
    table.parentNode.insertBefore(container, table);
    container.appendChild(table);
    container.appendChild(maxBtn);
  });
}

// Wrap standalone images with a zoom button (skips slider images)
function initImageZoom() {
  const imgs = viewer.querySelectorAll(
    '.markdown-body img:not(.slider-slide img), #viewer img:not(.slider-slide img)'
  );

  imgs.forEach(img => {
    if (img.parentNode.classList?.contains('img-zoom-container')) return;

    const container = document.createElement('div');
    container.className = 'img-zoom-container';

    const btn = document.createElement('button');
    btn.className = 'img-zoom-btn';
    btn.title = 'Zoom image';
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      ipcRenderer.send('open-image-popup', {
        src: img.src,
        alt: img.alt || '',
        isDarkMode: document.body.classList.contains('dark-mode')
      });
    });

    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
    container.appendChild(btn);
  });
}

// Add copy buttons to code blocks
function addCodeBlockCopyButtons() {
  const codeBlocks = viewer.querySelectorAll('.markdown-body pre, #viewer pre');

  codeBlocks.forEach((pre) => {
    // Skip if already wrapped
    if (pre.parentNode.classList?.contains('code-block-container')) {
      return;
    }

    // Get the code element inside pre
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;

    // Create container
    const container = document.createElement('div');
    container.className = 'code-block-container';

    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = `
      <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    copyBtn.addEventListener('click', async () => {
      // Get the raw text content (without formatting)
      const textContent = codeElement.textContent;

      try {
        await navigator.clipboard.writeText(textContent);

        // Show success feedback
        const copyIcon = copyBtn.querySelector('.copy-icon');
        const checkIcon = copyBtn.querySelector('.check-icon');
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyBtn.classList.add('copied');

        // Reset after 2 seconds
        setTimeout(() => {
          copyIcon.style.display = 'block';
          checkIcon.style.display = 'none';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showNotification(i18n('notif.copyFailed'), 2000);
      }
    });

    // Wrap pre in container and add button
    pre.parentNode.insertBefore(container, pre);
    container.appendChild(pre);
    container.appendChild(copyBtn);
  });
}

// Extract table data as structured JSON for Tabulator
function extractTableData(table) {
  const data = [];
  const columns = [];

  // Extract headers
  const headerRow = table.querySelector('thead tr, tr:first-child');
  if (headerRow) {
    const headers = headerRow.querySelectorAll('th, td');
    headers.forEach((header, index) => {
      const headerText = header.textContent.trim() || `Column ${index + 1}`;
      columns.push({
        title: headerText,
        field: `col${index}`,
        headerFilter: 'input',
        headerFilterPlaceholder: 'Filter...'
      });
    });
  }

  // Extract data rows
  const tbody = table.querySelector('tbody') || table;
  const rows = tbody.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    // Skip header row if no thead
    if (!table.querySelector('thead') && rowIndex === 0) {
      return;
    }

    const cells = row.querySelectorAll('td, th');
    if (cells.length > 0) {
      const rowData = {};
      cells.forEach((cell, index) => {
        rowData[`col${index}`] = cell.textContent.trim();
      });
      data.push(rowData);
    }
  });

  return { columns, data };
}

// Handle file opened
ipcRenderer.on('file-opened', async (event, data) => {
  // Reset translation state and start background translation
  resetTranslationState();

  // Clear undo/redo history on new file
  historyClear();
  _lastRenderedContent = null;

  // Store original markdown for editor
  originalMarkdown = data.content;

  // If in edit mode, update editor content
  if (isEditMode) {
    markdownEditor.value = originalMarkdown;
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
  }

  await renderMarkdown(data.content);

  // Update file info bar
  updateFileInfo(data.path);

  // Handle navigation history and scroll position
  if (isNavigating) {
    // Restore scroll position for back/forward navigation
    const entry = navigationHistory[navigationIndex];
    if (entry && entry.scrollPosition) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        contentWrapper.scrollTop = entry.scrollPosition;
      }, 100);
    }
    isNavigating = false;
  } else {
    // Add to navigation history for normal file opens
    addToNavigationHistory(data.path, 0);
    // Scroll to top for new files
    contentWrapper.scrollTop = 0;
  }

  // Enable file tracking
  isFileTrackingActive = true;

  // If multiple files were selected, add all to recent files
  if (data.allPaths && data.allPaths.length > 0) {
    data.allPaths.forEach(filePath => {
      saveRecentFile(filePath);
    });
  } else {
    // Fallback for single file (backwards compatibility)
    saveRecentFile(data.path);
  }

  // Start background translation immediately
  startBackgroundTranslation();
});

// Handle file changed externally
ipcRenderer.on('file-changed-externally', (event, data) => {
  console.log('File changed externally:', data.path);

  // Don't show notification if we have unsaved changes (tracking should be paused anyway)
  if (hasUnsavedChanges) {
    return;
  }

  // Show notification
  showFileUpdateNotification();
});

// Handle file deleted
ipcRenderer.on('file-deleted', (event, data) => {
  console.log('File deleted:', data.path);
  showNotification(i18n('notif.fileDeleted'), 5000);
  isFileTrackingActive = false;
});

// Handle file not found (from recent files or links)
ipcRenderer.on('file-not-found', (event, data) => {
  console.log('File not found:', data.path);
  showNotification(i18n('notif.fileNotFound') + path.basename(data.path), 4000);

  // Remove from recent files if it exists there
  let recentFiles = getRecentFiles();
  const filtered = recentFiles.filter(f => f.path !== data.path);
  if (filtered.length !== recentFiles.length) {
    localStorage.setItem('recentFiles', JSON.stringify(filtered));
    updateFileMenuRecent();
  }
});

// Handle file reload result
ipcRenderer.on('file-reload-result', async (event, data) => {
  if (data.success) {
    // Reset translation and store new content
    resetTranslationState();
    originalMarkdown = data.content;

    // If in edit mode, update editor content
    if (isEditMode) {
      markdownEditor.value = originalMarkdown;
      hasUnsavedChanges = false;
      updateUnsavedIndicator();
    }

    // Re-render the markdown
    await renderMarkdown(data.content);

    // Start background translation
    startBackgroundTranslation();

    showNotification(i18n('notif.fileReloaded'), 2000);
  } else {
    showNotification(i18n('notif.reloadFailed') + data.error, 4000);
  }
});

// Handle external file open request (from double-clicking a file when app is already open)
ipcRenderer.on('external-file-open-request', (event, data) => {
  const { filePath } = data;

  // Check for unsaved changes
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm(i18n('confirm.unsavedOpenFile', {name: filePath.split(/[\\/]/).pop()}))) {
      return; // User canceled, don't open the new file
    }
  }

  // Proceed with opening the file
  ipcRenderer.send('request-open-file', { filePath });
});

// Handle error messages from main process
ipcRenderer.on('show-error', (event, message) => {
  showNotification(message, 5000);
});

// Update zoom on load
updateZoom();

// ============================================
// Auto-Update UI Handler
// ============================================

const appUpdateToast = document.getElementById('appUpdateToast');
const updateTitle = document.getElementById('updateTitle');
const updateMessage = document.getElementById('updateMessage');
const updateProgress = document.getElementById('updateProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const updateActions = document.getElementById('updateActions');
const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');
const laterUpdateBtn = document.getElementById('laterUpdateBtn');
const closeUpdateToast = document.getElementById('closeUpdateToast');

let pendingUpdateVersion = null;

function showUpdateToast() {
  appUpdateToast.classList.add('show');
}

function hideUpdateToast() {
  appUpdateToast.classList.remove('show');
}

// formatBytes is imported from utils.js

// Update status handler
ipcRenderer.on('update-status', (event, data) => {
  switch (data.status) {
    case 'checking':
      // Silent check, don't show UI
      break;

    case 'available':
      pendingUpdateVersion = data.version;
      updateTitle.textContent = i18n('updateAvailable');
      updateMessage.textContent = i18n('update.versionReady', {version: data.version});
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'flex';
      downloadUpdateBtn.textContent = i18n('update.download');
      installUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'block';
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'not-available':
      // Silent, no update available
      break;

    case 'downloading':
      updateTitle.textContent = i18n('update.downloading');
      updateMessage.textContent = `${formatBytes(data.transferred)} / ${formatBytes(data.total)}`;
      updateProgress.style.display = 'flex';
      progressFill.style.width = `${data.percent}%`;
      progressText.textContent = `${Math.round(data.percent)}%`;
      downloadUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'none';
      updateActions.style.display = 'none';
      break;

    case 'downloaded':
      updateTitle.textContent = i18n('update.ready');
      updateMessage.textContent = i18n('update.versionInstall', {version: data.version});
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'none';
      installUpdateBtn.style.display = 'flex';
      laterUpdateBtn.style.display = 'block';
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'error':
      updateTitle.textContent = i18n('update.error');
      updateMessage.textContent = data.error || i18n('update.failed');
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'none';
      installUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'block';
      laterUpdateBtn.textContent = i18n('dismiss');
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'dev-mode':
      // Silent in dev mode
      console.log('Auto-updater:', data.message);
      break;
  }
});

// Update button handlers
downloadUpdateBtn.addEventListener('click', () => {
  ipcRenderer.send('download-update');
});

installUpdateBtn.addEventListener('click', () => {
  ipcRenderer.send('install-update');
});

laterUpdateBtn.addEventListener('click', () => {
  hideUpdateToast();
  laterUpdateBtn.textContent = i18n('later'); // Reset text
});

closeUpdateToast.addEventListener('click', () => {
  hideUpdateToast();
  laterUpdateBtn.textContent = i18n('later'); // Reset text
});

// ============================================
// Context Menu
// ============================================

const contextMenu = document.getElementById('contextMenu');
const ctxCopy = document.getElementById('ctxCopy');
const ctxCopyPlain = document.getElementById('ctxCopyPlain');
const ctxBold = document.getElementById('ctxBold');
const ctxItalic = document.getElementById('ctxItalic');
const ctxCode = document.getElementById('ctxCode');
const ctxList = document.getElementById('ctxList');
const ctxRemoveFormat = document.getElementById('ctxRemoveFormat');
const ctxEditText = document.getElementById('ctxEditText');
const ctxAddNote = document.getElementById('ctxAddNote');
const ctxEditNote = document.getElementById('ctxEditNote');
const ctxDeleteNote = document.getElementById('ctxDeleteNote');
const ctxFindNote = document.getElementById('ctxFindNote');
const ctxInsertImage = document.getElementById('ctxInsertImage');
const ctxDeleteImage = document.getElementById('ctxDeleteImage');
const ctxSelectAll = document.getElementById('ctxSelectAll');

// Note dialog elements
const noteDialogOverlay = document.getElementById('noteDialogOverlay');
const noteDialogTitle = document.getElementById('noteDialogTitle');
const noteDialogClose = document.getElementById('noteDialogClose');
const noteTitleInput = document.getElementById('noteTitle');
const noteContentInput = document.getElementById('noteContent');
const noteSaveBtn = document.getElementById('noteSaveBtn');
const noteCancelBtn = document.getElementById('noteCancelBtn');
const noteColorOptions = document.querySelectorAll('.note-color-option');
const noteLabelInput = document.getElementById('noteLabelName');
const noteTooltip = document.getElementById('noteTooltip');
const noteDialogIdSpan = document.getElementById('noteDialogId');

// Find Note dialog elements
const findNoteOverlay = document.getElementById('findNoteOverlay');
const findNoteInput = document.getElementById('findNoteInput');
const findNoteBtn = document.getElementById('findNoteBtn');
const findNoteCancelBtn = document.getElementById('findNoteCancelBtn');
const findNoteClose = document.getElementById('findNoteClose');

// Store selection when context menu opens
let savedSelection = null;
let savedSelectionHtml = null;
let savedSelectionOccurrence = 0;
let savedRange = null;
let rightClickTarget = null;
let pendingSliderImageAdd = false; // flag: image dialog opened by "Add to Slider", not "Insert Image"
let rightClickY = 0;
let rightClickX = 0;
let rightClickCaretInfo = null;
let rightClickLabelPos = null; // {left, top} relative to viewer
let savedCursorPosition = null;

function showContextMenu(x, y) {
  // Get and save selected text
  const selection = window.getSelection();
  const hasSelection = selection && selection.toString().trim().length > 0;

  // Save the selection text and HTML
  if (hasSelection && selection.rangeCount > 0) {
    savedSelection = selection.toString();

    // Save HTML version
    const range = selection.getRangeAt(0);
    savedRange = range.cloneRange();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());
    savedSelectionHtml = tempDiv.innerHTML;

    // Count which occurrence of the selected text this is (for tables with duplicate values)
    try {
      const preRange = document.createRange();
      preRange.selectNodeContents(viewer);
      preRange.setEnd(range.startContainer, range.startOffset);
      const textBefore = preRange.toString();
      let count = 0;
      let pos = 0;
      while ((pos = textBefore.indexOf(savedSelection, pos)) !== -1) {
        count++;
        pos += savedSelection.length;
      }
      savedSelectionOccurrence = count;
    } catch (e) {
      savedSelectionOccurrence = 0;
    }
  } else {
    savedSelection = null;
    savedSelectionHtml = null;
    savedSelectionOccurrence = 0;
    savedRange = null;
  }

  // Enable/disable copy items based on selection
  if (hasSelection) {
    ctxCopy.classList.remove('disabled');
    ctxCopyPlain.classList.remove('disabled');
  } else {
    ctxCopy.classList.add('disabled');
    ctxCopyPlain.classList.add('disabled');
  }

  // Enable/disable formatting options (enabled when text is selected in any mode)
  // Check if right-clicked on an image (for note adding)
  const clickedImgForNote = rightClickTarget && (rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img'));

  if (hasSelection) {
    ctxBold.classList.remove('disabled');
    ctxItalic.classList.remove('disabled');
    ctxCode.classList.remove('disabled');
    ctxList.classList.remove('disabled');
    ctxRemoveFormat.classList.remove('disabled');
    ctxAddNote.classList.remove('disabled');
  } else {
    ctxBold.classList.add('disabled');
    ctxItalic.classList.add('disabled');
    ctxCode.classList.add('disabled');
    ctxList.classList.add('disabled');
    ctxRemoveFormat.classList.add('disabled');
    // Enable Add Note when a file is open (label-based, no selection needed)
    if (currentFilePath) {
      ctxAddNote.classList.remove('disabled');
    } else {
      ctxAddNote.classList.add('disabled');
    }
  }

  // Show/hide Edit Text based on selection and file open
  if (hasSelection && currentFilePath) {
    ctxEditText.style.display = '';
  } else {
    ctxEditText.style.display = 'none';
  }

  // Show/hide Edit Note / Delete Note based on whether a noted element was right-clicked
  const clickedNote = rightClickTarget && rightClickTarget.closest?.('.noted-text, .noted-image, .note-label');
  if (clickedNote) {
    ctxEditNote.style.display = '';
    ctxDeleteNote.style.display = '';
  } else {
    ctxEditNote.style.display = 'none';
    ctxDeleteNote.style.display = 'none';
  }

  // Show/hide "Find Note" based on whether a file is open
  if (currentFilePath) {
    ctxFindNote.style.display = '';
  } else {
    ctxFindNote.style.display = 'none';
  }

  // Show/hide "Delete Image" and "Copy Image Source" based on whether an image was right-clicked
  const clickedImg = rightClickTarget && (rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img'));
  if (clickedImg && clickedImg.src) {
    if (clickedImg.src.startsWith('data:')) ctxDeleteImage.style.display = '';
    else ctxDeleteImage.style.display = 'none';
    if (ctxCopyImageSrc) ctxCopyImageSrc.style.display = '';
  } else {
    ctxDeleteImage.style.display = 'none';
    if (ctxCopyImageSrc) ctxCopyImageSrc.style.display = 'none';
  }

  // Update new context menu items visibility (mermaid, table, code, etc.)
  updateNewContextMenuItems();

  // Use helper for positioning (handles screen edge adjustment)
  positionContextMenu(contextMenu, x, y);
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
}

// Show context menu on right-click in viewer area
viewer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  rightClickTarget = e.target;
  rightClickY = e.clientY;
  rightClickX = e.clientX;

  // Calculate label position relative to the viewer element
  const viewerRect = viewer.getBoundingClientRect();
  rightClickLabelPos = {
    left: e.clientX - viewerRect.left,
    top: e.clientY - viewerRect.top
  };

  // Capture exact caret position at the right-click point
  rightClickCaretInfo = null;
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (range && range.startContainer) {
      const node = range.startContainer;
      const offset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE) {
        const fullText = node.textContent;
        const textBefore = fullText.substring(Math.max(0, offset - 30), offset);
        const textAfter = fullText.substring(offset, Math.min(fullText.length, offset + 30));
        rightClickCaretInfo = { textBefore, textAfter, offset, fullText };
      }
    }
  }

  showContextMenu(e.clientX, e.clientY);
});

// Also allow context menu in editor
markdownEditor.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  rightClickTarget = e.target;
  rightClickY = e.clientY;
  savedCursorPosition = markdownEditor.selectionStart;
  showContextMenu(e.clientX, e.clientY);
});

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// Hide context menu on scroll or resize
document.addEventListener('scroll', hideContextMenu, true);
window.addEventListener('resize', hideContextMenu);

// Hide context menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// Copy with formatting (HTML)
ctxCopy.addEventListener('click', async (e) => {
  console.log('Copy clicked!');
  e.stopPropagation();

  if (ctxCopy.classList.contains('disabled')) {
    console.log('Copy is disabled');
    return;
  }

  hideContextMenu();

  if (!savedSelection || !savedSelection.trim()) {
    showNotification(i18n('notif.noTextSelected'), 1500);
    return;
  }

  console.log('Attempting to copy:', savedSelection.substring(0, 50));

  try {
    // Try simple plain text first
    await navigator.clipboard.writeText(savedSelection);
    console.log('Copy successful');
    showNotification(i18n('notif.copied'), 1500);
  } catch (err) {
    console.error('Copy failed:', err);
    showNotification(i18n('notif.copyError') + err.message, 3000);
  }
});

// Copy as plain text
ctxCopyPlain.addEventListener('click', async (e) => {
  console.log('Copy plain clicked!');
  e.stopPropagation();

  if (ctxCopyPlain.classList.contains('disabled')) {
    console.log('Copy plain is disabled');
    return;
  }

  hideContextMenu();

  if (!savedSelection || !savedSelection.trim()) {
    showNotification(i18n('notif.noTextSelected'), 1500);
    return;
  }

  console.log('Attempting to copy plain:', savedSelection.substring(0, 50));

  try {
    await navigator.clipboard.writeText(savedSelection);
    console.log('Copy plain successful');
    showNotification(i18n('notif.copiedPlain'), 1500);
  } catch (err) {
    console.error('Copy plain failed:', err);
    showNotification(i18n('notif.copyError') + err.message, 3000);
  }
});

// Select all
ctxSelectAll.addEventListener('click', () => {
  // Determine which element to select based on focus
  if (isEditMode && document.activeElement === markdownEditor) {
    markdownEditor.select();
  } else {
    // Select all content in viewer
    const range = document.createRange();
    range.selectNodeContents(viewer);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  hideContextMenu();
});

// Formatting functions - work in both view and edit mode
function applyMarkdownFormat(wrapper, multiline = false) {
  if (!savedSelection || !currentFilePath) return;

  let formattedText;
  if (multiline) {
    // For lists - apply to each line
    const lines = savedSelection.split('\n');
    formattedText = lines.map(line => line.trim() ? wrapper + line : line).join('\n');
  } else {
    // For inline formatting - wrap the text
    formattedText = wrapper + savedSelection + wrapper;
  }

  if (isEditMode) {
    // Edit mode: Replace in editor
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;

    markdownEditor.value =
      markdownEditor.value.substring(0, start) +
      formattedText +
      markdownEditor.value.substring(end);

    // Restore selection
    markdownEditor.focus();
    markdownEditor.selectionStart = start;
    markdownEditor.selectionEnd = start + formattedText.length;

    // Mark as unsaved
    hasUnsavedChanges = true;
    updateUnsavedIndicator();

    // Trigger preview update
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      renderMarkdown(markdownEditor.value);
    }, PREVIEW_DEBOUNCE_DELAY);
  } else {
    // View mode: Apply formatting to active markdown
    const markdownContent = getActiveMarkdown();

    // Find the correct occurrence of selected text in markdown
    const textIndex = findNthOccurrence(markdownContent, savedSelection, savedSelectionOccurrence);

    if (textIndex !== -1) {
      // Save current scroll position
      const scrollPosition = contentWrapper.scrollTop;

      // Replace the text with formatted version
      const newContent =
        markdownContent.substring(0, textIndex) +
        formattedText +
        markdownContent.substring(textIndex + savedSelection.length);

      const syncFn = () => {
        // Sync formatting to originalMarkdown
        const origText = findOriginalForTranslated(savedSelection);
        if (origText) {
          const oi = findNthOccurrence(originalMarkdown, origText, savedSelectionOccurrence);
          if (oi !== -1) {
            let origFormatted;
            if (formattedText.startsWith('- ')) {
              const lines = origText.split('\n');
              origFormatted = lines.map(line => line.trim() ? '- ' + line : line).join('\n');
            } else {
              const w = formattedText.substring(0, formattedText.indexOf(savedSelection));
              origFormatted = w + origText + w;
            }
            originalMarkdown = originalMarkdown.substring(0, oi) + origFormatted + originalMarkdown.substring(oi + origText.length);
          }
        }
      };

      // For inline formats (bold/italic), try direct DOM patch to avoid full re-render
      const domTagMap = { '**': 'strong', '*': 'em' };
      const domTag = !multiline ? domTagMap[wrapper] : null;
      if (domTag && patchInlineFormatInDOM(domTag)) {
        updateSourceSilently(newContent, syncFn);
      } else {
        commitViewModeEdit(newContent, scrollPosition, syncFn);
      }
    } else {
      showNotification(i18n('notif.textNotFound'), 2000);
    }
  }
}

// Bold
ctxBold.addEventListener('click', () => {
  hideContextMenu();
  applyMarkdownFormat('**');
  if (isEditMode) {
    showNotification(i18n('notif.boldApplied'), 1500);
  }
});

// Italic
ctxItalic.addEventListener('click', () => {
  hideContextMenu();
  applyMarkdownFormat('*');
  if (isEditMode) {
    showNotification(i18n('notif.italicApplied'), 1500);
  }
});

// Code block
ctxCode.addEventListener('click', () => {
  if (!savedSelection || !currentFilePath) return;
  hideContextMenu();

  // Check if it's multiline or single line
  const isMultiline = savedSelection.includes('\n');
  let formattedText;

  if (isMultiline) {
    // Use code block with ```
    formattedText = '```\n' + savedSelection + '\n```';
  } else {
    // Use inline code with backticks
    formattedText = '`' + savedSelection + '`';
  }

  if (isEditMode) {
    // Edit mode: Replace in editor
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;

    markdownEditor.value =
      markdownEditor.value.substring(0, start) +
      formattedText +
      markdownEditor.value.substring(end);

    // Restore selection
    markdownEditor.focus();
    markdownEditor.selectionStart = start;
    markdownEditor.selectionEnd = start + formattedText.length;

    // Mark as unsaved
    hasUnsavedChanges = true;
    updateUnsavedIndicator();

    // Trigger preview update
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      renderMarkdown(markdownEditor.value);
    }, PREVIEW_DEBOUNCE_DELAY);

    showNotification(i18n('notif.codeApplied'), 1500);
  } else {
    // View mode: Apply formatting to active markdown
    const markdownContent = getActiveMarkdown();
    const textIndex = findNthOccurrence(markdownContent, savedSelection, savedSelectionOccurrence);

    if (textIndex !== -1) {
      const scrollPosition = contentWrapper.scrollTop;
      const newContent =
        markdownContent.substring(0, textIndex) +
        formattedText +
        markdownContent.substring(textIndex + savedSelection.length);

      const syncFn = () => {
        const origText = findOriginalForTranslated(savedSelection);
        if (origText) {
          const oi = findNthOccurrence(originalMarkdown, origText, savedSelectionOccurrence);
          if (oi !== -1) {
            const isML = origText.includes('\n');
            const origFmt = isML ? ('```\n' + origText + '\n```') : ('`' + origText + '`');
            originalMarkdown = originalMarkdown.substring(0, oi) + origFmt + originalMarkdown.substring(oi + origText.length);
          }
        }
      };

      // For single-line (inline) code, try direct DOM patch to avoid full re-render
      if (!isMultiline && patchInlineFormatInDOM('code')) {
        updateSourceSilently(newContent, syncFn);
      } else {
        commitViewModeEdit(newContent, scrollPosition, syncFn);
      }

      showNotification(i18n('notif.codeApplied'), 1500);
    } else {
      showNotification(i18n('notif.textNotFound'), 2000);
    }
  }
});

// Make list
ctxList.addEventListener('click', () => {
  hideContextMenu();
  applyMarkdownFormat('- ', true);
  if (isEditMode) {
    showNotification(i18n('notif.listApplied'), 1500);
  }
});

// Remove formatting
ctxRemoveFormat.addEventListener('click', () => {
  if (!savedSelection || !currentFilePath) return;
  hideContextMenu();

  if (isEditMode) {
    // Edit mode: Remove formatting from selected markdown text
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selectedText = markdownEditor.value.substring(start, end);

    let cleanText = selectedText
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold
      .replace(/\*([^*]+)\*/g, '$1')      // Italic
      .replace(/`([^`]+)`/g, '$1')        // Inline code
      .replace(/^```\n?/gm, '')           // Code block start
      .replace(/\n?```$/gm, '')           // Code block end
      .replace(/^- /gm, '')               // List items
      .replace(/^> /gm, '')               // Blockquotes
      .replace(/^#+\s/gm, '');            // Headers

    markdownEditor.value =
      markdownEditor.value.substring(0, start) +
      cleanText +
      markdownEditor.value.substring(end);

    // Restore selection
    markdownEditor.focus();
    markdownEditor.selectionStart = start;
    markdownEditor.selectionEnd = start + cleanText.length;

    // Mark as unsaved
    hasUnsavedChanges = true;
    updateUnsavedIndicator();

    // Trigger preview update
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      renderMarkdown(markdownEditor.value);
    }, PREVIEW_DEBOUNCE_DELAY);

    showNotification(i18n('notif.formatRemoved'), 1500);
  } else {
    // View mode: Find text with various markdown formatting patterns
    const markdownContent = getActiveMarkdown();
    const plainText = savedSelection;

    // Try to find the text with different markdown formatting
    const patterns = [
      `**${plainText}**`,     // Bold
      `*${plainText}*`,       // Italic
      `\`${plainText}\``,     // Inline code
      `***${plainText}***`,   // Bold + Italic
    ];

    let foundIndex = -1;
    let foundPattern = null;

    // Try each pattern
    for (const pattern of patterns) {
      const idx = markdownContent.indexOf(pattern);
      if (idx !== -1) {
        foundIndex = idx;
        foundPattern = pattern;
        break;
      }
    }

    // Also try the plain text
    if (foundIndex === -1) {
      foundIndex = markdownContent.indexOf(plainText);
      foundPattern = plainText;
    }

    if (foundIndex !== -1) {
      const scrollPosition = contentWrapper.scrollTop;
      const newContent =
        markdownContent.substring(0, foundIndex) +
        plainText +
        markdownContent.substring(foundIndex + foundPattern.length);

      const syncFn = () => {
        // Sync to originalMarkdown: remove formatting of corresponding original text
        const origText = findOriginalForTranslated(plainText);
        if (origText) {
          const origPatterns = [`**${origText}**`, `*${origText}*`, `\`${origText}\``, `***${origText}***`];
          for (const op of origPatterns) {
            const oi = originalMarkdown.indexOf(op);
            if (oi !== -1) {
              originalMarkdown = originalMarkdown.substring(0, oi) + origText + originalMarkdown.substring(oi + op.length);
              break;
            }
          }
        }
      };

      // Try direct DOM patch to avoid full re-render
      if (patchRemoveFormatInDOM()) {
        updateSourceSilently(newContent, syncFn);
      } else {
        commitViewModeEdit(newContent, scrollPosition, syncFn);
      }

      showNotification(i18n('notif.formatRemoved'), 1500);
    } else {
      showNotification(i18n('notif.textNotFound'), 2000);
    }
  }
});

// ============================================
// Add Note Feature
// ============================================

let noteSelectedColor = '#ff6600';
let editingNoteElement = null;

// Helper: get next available note ID by scanning existing notes in source
// Wrap text with a note span while preserving markdown line-level syntax.
// Returns { prefix, wrappedContent } where prefix stays outside the span.
// For multi-line selections, wraps each line's content individually.
function wrapWithNoteSpan(text, noteId, escTitle, escContent, color) {
  const _r = parseInt(color.slice(1,3), 16), _g = parseInt(color.slice(3,5), 16), _b = parseInt(color.slice(5,7), 16);
  const noteStyle = `background-color:rgba(${_r},${_g},${_b},0.25);text-decoration:underline;text-decoration-color:${color};text-decoration-thickness:2px`;
  const spanOpen = `<span class="noted-text" data-note-id="${noteId}" data-note-title="${escTitle}" data-note-content="${escContent}" data-note-color="${color}" style="${noteStyle}">`;
  const spanClose = '</span>';

  // Regex to match markdown line prefixes: headings, list items, blockquotes, hr
  const prefixRe = /^(#{1,6}\s+|(?:[-*+]|\d+\.)\s+|>\s*|={3,}|-{3,}|\*{3,})/;

  const lines = text.split('\n');
  const wrappedLines = lines.map((line, idx) => {
    const m = line.match(prefixRe);
    if (m) {
      const prefix = m[1];
      const content = line.slice(prefix.length);
      // Only wrap if there's actual content after prefix
      if (content.length > 0) {
        return prefix + spanOpen + content + spanClose;
      }
      return line;
    }
    // For non-prefix lines, wrap entire line (but not empty lines)
    if (line.trim().length > 0) {
      // Also preserve inline markdown wrappers like **bold**, *italic*, etc.
      // by wrapping the whole line — marked parser handles inline HTML fine
      return spanOpen + line + spanClose;
    }
    return line;
  });

  return wrappedLines.join('\n');
}

// Find the Nth occurrence (0-based) of searchStr in source
function findNthOccurrence(source, searchStr, n) {
  let pos = -1;
  for (let i = 0; i <= n; i++) {
    pos = source.indexOf(searchStr, pos + 1);
    if (pos === -1) return -1;
  }
  return pos;
}

function getNextNoteId(source) {
  let maxId = 0;
  const idMatches = source.matchAll(/data-note-id="(\d+)"/g);
  for (const m of idMatches) {
    const id = parseInt(m[1], 10);
    if (id > maxId) maxId = id;
  }
  return maxId + 1;
}

// Helper: find a note span in markdown source using regex (browser normalizes outerHTML so indexOf fails)
function findNoteSpanInSource(source, noteEl) {
  const rawTitle = noteEl.getAttribute('data-note-title') || '';
  const rawContent = noteEl.getAttribute('data-note-content') || '';

  // Re-escape the same way they were escaped when creating the note
  const srcTitle = rawTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const srcContent = rawContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const className = noteEl.classList.contains('note-label') ? 'note-label'
    : noteEl.classList.contains('noted-image') ? 'noted-image' : 'noted-text';

  // data-note-id is optional (old notes don't have it)
  const regex = new RegExp(
    `<span class="${className}"(?: data-note-id="\\d+")? data-note-title="${escapeRegex(srcTitle)}" data-note-content="${escapeRegex(srcContent)}"[^>]*>([\\s\\S]*?)</span>`
  );

  return source.match(regex);
}

function openNoteDialog() {
  // Reset dialog
  noteLabelInput.value = '';
  noteTitleInput.value = '';
  noteContentInput.value = '';
  noteSelectedColor = '#ff6600';
  editingNoteElement = null;
  noteDialogTitle.textContent = i18n('addNote');
  noteColorOptions.forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === noteSelectedColor);
  });
  // Show/hide label row based on whether text is selected
  const noteLabelRow = document.getElementById('noteLabelRow');
  const hasSelection = savedSelection && savedSelection.length > 0;
  noteLabelRow.style.display = hasSelection ? 'none' : '';

  noteDialogIdSpan.textContent = '';

  noteDialogOverlay.classList.add('visible');
  if (hasSelection) {
    noteTitleInput.focus();
  } else {
    noteLabelInput.focus();
  }
}

function openNoteDialogForEdit(noteEl) {
  editingNoteElement = noteEl;
  noteDialogTitle.textContent = i18n('editNote');

  // Read existing values from the note element
  const title = noteEl.getAttribute('data-note-title') || '';
  const content = noteEl.getAttribute('data-note-content') || '';
  // Unescape HTML entities for editing
  const tempEl = document.createElement('textarea');
  tempEl.innerHTML = title;
  noteTitleInput.value = tempEl.value;
  tempEl.innerHTML = content;
  noteContentInput.value = tempEl.value;

  // Handle label input for note-label elements
  const isLabel = noteEl.classList.contains('note-label');
  const noteLabelRow = document.getElementById('noteLabelRow');
  if (isLabel) {
    noteLabelInput.value = noteEl.textContent;
    noteLabelRow.style.display = '';
  } else {
    noteLabelInput.value = '';
    noteLabelRow.style.display = 'none';
  }

  // Detect color from the element - try attribute first, then computed style
  const isImage = noteEl.classList.contains('noted-image');
  if (isLabel) {
    // Extract color from background-color hex
    const styleAttr = noteEl.getAttribute('style') || '';
    const bgHexMatch = styleAttr.match(/background-color:\s*(#[0-9a-fA-F]{6})/);
    if (bgHexMatch) {
      noteSelectedColor = bgHexMatch[1];
    }
  } else if (isImage) {
    // Extract color from background-color rgba
    const styleAttr = noteEl.getAttribute('style') || '';
    const bgMatch = styleAttr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (bgMatch) {
      const r = parseInt(bgMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(bgMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(bgMatch[3]).toString(16).padStart(2, '0');
      noteSelectedColor = `#${r}${g}${b}`;
    }
  } else {
    // New format: data-note-color attribute
    const dataColor = noteEl.getAttribute('data-note-color');
    if (dataColor) {
      noteSelectedColor = dataColor;
    } else {
      // Legacy fallback: inline style color
      const styleAttr = noteEl.getAttribute('style') || '';
      const hexMatch = styleAttr.match(/color:\s*(#[0-9a-fA-F]{6})/);
      if (hexMatch) {
        noteSelectedColor = hexMatch[1];
      }
    }
  }

  noteColorOptions.forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === noteSelectedColor);
  });

  noteDialogIdSpan.textContent = '';

  noteDialogOverlay.classList.add('visible');
  noteLabelInput.focus();
}

function closeNoteDialog() {
  noteDialogOverlay.classList.remove('visible');
  editingNoteElement = null;
}

// Color picker
noteColorOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    noteColorOptions.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    noteSelectedColor = btn.dataset.color;
  });
});

// Close dialog
noteDialogClose.addEventListener('click', closeNoteDialog);
noteCancelBtn.addEventListener('click', closeNoteDialog);
noteDialogOverlay.addEventListener('click', (e) => {
  if (e.target === noteDialogOverlay) closeNoteDialog();
});

// Add Note context menu click
ctxAddNote.addEventListener('click', () => {
  if (ctxAddNote.classList.contains('disabled')) return;
  if (!currentFilePath) return;
  hideContextMenu();
  openNoteDialog();
});

// Edit Note context menu click
ctxEditNote.addEventListener('click', () => {
  hideContextMenu();
  const noteEl = rightClickTarget && rightClickTarget.closest('.noted-text, .noted-image, .note-label');
  if (!noteEl || !currentFilePath) return;
  openNoteDialogForEdit(noteEl);
});

// Delete Note context menu click
ctxDeleteNote.addEventListener('click', () => {
  hideContextMenu();
  const noteEl = rightClickTarget && rightClickTarget.closest('.noted-text, .noted-image, .note-label');
  if (!noteEl || !currentFilePath) return;

  const isLabel = noteEl.classList.contains('note-label');

  if (isEditMode) {
    const editorVal = markdownEditor.value;
    const match = findNoteSpanInSource(editorVal, noteEl);
    if (match) {
      // For labels, remove the entire span (no original content to restore)
      // For noted-text/noted-image, restore inner content
      const replacement = isLabel ? '' : match[1];
      markdownEditor.value =
        editorVal.substring(0, match.index) +
        replacement +
        editorVal.substring(match.index + match[0].length);

      hasUnsavedChanges = true;
      updateUnsavedIndicator();

      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        renderMarkdown(markdownEditor.value);
      }, 300);

      showNotification(i18n('notif.noteRemoved'), 1500);
    } else {
      showNotification(i18n('notif.noteNotFound'), 2000);
    }
  } else {
    // View mode
    const activeSource = getActiveMarkdown();
    const match = findNoteSpanInSource(activeSource, noteEl);
    if (match) {
      const replacement = isLabel ? '' : match[1];
      const newContent =
        activeSource.substring(0, match.index) +
        replacement +
        activeSource.substring(match.index + match[0].length);

      // Update source silently (no full re-render)
      const nid = noteEl.getAttribute('data-note-id');
      if (isShowingTranslation && translatedMarkdown) {
        translatedMarkdown = newContent;
        // Sync note removal to originalMarkdown
        const origMatch = nid ? findNoteSpanById(originalMarkdown, nid) : findNoteSpanInSource(originalMarkdown, noteEl);
        if (origMatch) {
          const origReplacement = isLabel ? '' : origMatch[1];
          originalMarkdown = originalMarkdown.substring(0, origMatch.index) + origReplacement + originalMarkdown.substring(origMatch.index + origMatch[0].length);
        }
        clearTimeout(enViewResyncTimer);
        enViewResyncTimer = setTimeout(() => {
          if (isShowingTranslation && originalMarkdown) startBackgroundTranslation(true);
        }, 2000);
      } else {
        originalMarkdown = newContent;
        invalidateTranslationCache();
      }
      hasUnsavedChanges = true;

      // DOM patch — preserves mermaid diagrams and avoids full re-render
      if (nid) {
        patchNoteInDOM(nid, { deleted: true });
      } else {
        renderMarkdown(getActiveMarkdown()); // fallback for legacy notes without ID
      }

      showNotification(i18n('notif.noteRemoved'), 1500);
    } else {
      showNotification(i18n('notif.noteNotFound'), 2000);
    }
  }
});

// Save note
noteSaveBtn.addEventListener('click', () => {
  const labelName = noteLabelInput.value.trim();
  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();

  // --- Edit mode: update existing note ---
  if (editingNoteElement) {
    const isNoteLabel = editingNoteElement.classList.contains('note-label');
    // For label edits, label name is required; for old notes, title or content is required
    if (isNoteLabel && !labelName) {
      showNotification(i18n('notif.enterLabel'), 2000);
      return;
    }
    if (!isNoteLabel && !title && !content) {
      showNotification(i18n('notif.enterTitleOrContent'), 2000);
      return;
    }

    const color = noteSelectedColor;
    const escTitle = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escContent = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isNoteImage = editingNoteElement.classList.contains('noted-image');

    // Preserve existing ID for all note types
    let noteIdAttr = '';
    const existingId = editingNoteElement.getAttribute('data-note-id');
    if (existingId) {
      noteIdAttr = ` data-note-id="${existingId}"`;
    }

    // Preserve existing position for labels
    let labelPosStyle = '';
    if (isNoteLabel) {
      const existingStyle = editingNoteElement.getAttribute('style') || '';
      const leftMatch = existingStyle.match(/left:\s*([^;]+)/);
      const topMatch = existingStyle.match(/top:\s*([^;]+)/);
      if (leftMatch && topMatch) {
        labelPosStyle = `;left:${leftMatch[1].trim()};top:${topMatch[1].trim()}`;
      }
    }

    if (isEditMode) {
      const editorVal = markdownEditor.value;
      const match = findNoteSpanInSource(editorVal, editingNoteElement);
      if (match) {
        let newNoteHtml;
        if (isNoteLabel) {
          const escLabel = labelName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          newNoteHtml = `<span class="note-label"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:${color}${labelPosStyle}">${escLabel}</span>`;
        } else if (isNoteImage) {
          const innerContent = match[1];
          const r = parseInt(color.slice(1,3), 16);
          const g = parseInt(color.slice(3,5), 16);
          const b = parseInt(color.slice(5,7), 16);
          newNoteHtml = `<span class="noted-image"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:rgba(${r},${g},${b},0.15)">${innerContent}</span>`;
        } else {
          const innerContent = match[1];
          const _r = parseInt(color.slice(1,3), 16), _g = parseInt(color.slice(3,5), 16), _b = parseInt(color.slice(5,7), 16);
          const _noteStyle = `background-color:rgba(${_r},${_g},${_b},0.25);text-decoration:underline;text-decoration-color:${color};text-decoration-thickness:2px`;
          newNoteHtml = `<span class="noted-text"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" data-note-color="${color}" style="${_noteStyle}">${innerContent}</span>`;
        }

        markdownEditor.value =
          editorVal.substring(0, match.index) +
          newNoteHtml +
          editorVal.substring(match.index + match[0].length);

        hasUnsavedChanges = true;
        updateUnsavedIndicator();

        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(() => {
          renderMarkdown(markdownEditor.value);
        }, 300);

        showNotification(i18n('notif.noteUpdated'), 1500);
      } else {
        showNotification(i18n('notif.noteNotFound'), 2000);
      }
    } else {
      // View mode
      const activeSource = getActiveMarkdown();
      const match = findNoteSpanInSource(activeSource, editingNoteElement);
      if (match) {
        let newNoteHtml;
        if (isNoteLabel) {
          const escLabel = labelName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          newNoteHtml = `<span class="note-label"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:${color}${labelPosStyle}">${escLabel}</span>`;
        } else if (isNoteImage) {
          const innerContent = match[1];
          const r = parseInt(color.slice(1,3), 16);
          const g = parseInt(color.slice(3,5), 16);
          const b = parseInt(color.slice(5,7), 16);
          newNoteHtml = `<span class="noted-image"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:rgba(${r},${g},${b},0.15)">${innerContent}</span>`;
        } else {
          const innerContent = match[1];
          const _r = parseInt(color.slice(1,3), 16), _g = parseInt(color.slice(3,5), 16), _b = parseInt(color.slice(5,7), 16);
          const _noteStyle = `background-color:rgba(${_r},${_g},${_b},0.25);text-decoration:underline;text-decoration-color:${color};text-decoration-thickness:2px`;
          newNoteHtml = `<span class="noted-text"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" data-note-color="${color}" style="${_noteStyle}">${innerContent}</span>`;
        }

        const newContent =
          activeSource.substring(0, match.index) +
          newNoteHtml +
          activeSource.substring(match.index + match[0].length);

        // Update source silently (no full re-render)
        const nid = editingNoteElement.getAttribute('data-note-id');
        if (isShowingTranslation && translatedMarkdown) {
          translatedMarkdown = newContent;
          // Sync to originalMarkdown
          const origMatch = nid ? findNoteSpanById(originalMarkdown, nid) : findNoteSpanInSource(originalMarkdown, editingNoteElement);
          if (origMatch) {
            const origInner = origMatch[1];
            let origNewHtml;
            if (isNoteLabel) {
              const escLabel2 = labelName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              origNewHtml = `<span class="note-label"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:${color}${labelPosStyle}">${escLabel2}</span>`;
            } else if (isNoteImage) {
              const r2 = parseInt(color.slice(1,3), 16), g2 = parseInt(color.slice(3,5), 16), b2 = parseInt(color.slice(5,7), 16);
              origNewHtml = `<span class="noted-image"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:rgba(${r2},${g2},${b2},0.15)">${origInner}</span>`;
            } else {
              const _r3 = parseInt(color.slice(1,3), 16), _g3 = parseInt(color.slice(3,5), 16), _b3 = parseInt(color.slice(5,7), 16);
              const _ns3 = `background-color:rgba(${_r3},${_g3},${_b3},0.25);text-decoration:underline;text-decoration-color:${color};text-decoration-thickness:2px`;
              origNewHtml = `<span class="noted-text"${noteIdAttr} data-note-title="${escTitle}" data-note-content="${escContent}" data-note-color="${color}" style="${_ns3}">${origInner}</span>`;
            }
            originalMarkdown = originalMarkdown.substring(0, origMatch.index) + origNewHtml + originalMarkdown.substring(origMatch.index + origMatch[0].length);
            translateNoteAttrsToOriginal(nid, title, content);
          }
          clearTimeout(enViewResyncTimer);
          enViewResyncTimer = setTimeout(() => {
            if (isShowingTranslation && originalMarkdown) startBackgroundTranslation(true);
          }, 2000);
        } else {
          originalMarkdown = newContent;
          invalidateTranslationCache();
        }
        hasUnsavedChanges = true;

        // DOM patch — build updates based on note type, preserves mermaid diagrams
        const domUpdates = { title, content };
        if (isNoteLabel) {
          domUpdates.style = `background-color:${color}${labelPosStyle}`;
          domUpdates.labelText = labelName;
        } else if (isNoteImage) {
          const r = parseInt(color.slice(1,3), 16), g = parseInt(color.slice(3,5), 16), b = parseInt(color.slice(5,7), 16);
          domUpdates.style = `background-color:rgba(${r},${g},${b},0.15)`;
        } else {
          const _r = parseInt(color.slice(1,3), 16), _g = parseInt(color.slice(3,5), 16), _b = parseInt(color.slice(5,7), 16);
          domUpdates.style = `background-color:rgba(${_r},${_g},${_b},0.25);text-decoration:underline;text-decoration-color:${color};text-decoration-thickness:2px`;
          domUpdates.color = color;
        }
        if (nid) {
          patchNoteInDOM(nid, domUpdates);
        } else {
          renderMarkdown(getActiveMarkdown()); // fallback for legacy notes without ID
        }

        showNotification(i18n('notif.noteUpdated'), 1500);
      } else {
        showNotification(i18n('notif.noteNotFound'), 2000);
      }
    }

    editingNoteElement = null;
    closeNoteDialog();
    return;
  }

  // --- Add new note ---
  const hasTextSelection = savedSelection && savedSelection.length > 0;
  const isImageTarget = rightClickTarget && rightClickTarget.tagName === 'IMG';

  const color = noteSelectedColor;
  const escTitle = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escContent = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (hasTextSelection || isImageTarget) {
    // ---- Text selected or image: wrap with noted-text / noted-image ----
    if (!title && !content) {
      showNotification(i18n('notif.enterTitleOrContent'), 2000);
      return;
    }

    const currentSource = isEditMode ? markdownEditor.value : getActiveMarkdown();
    const noteId = getNextNoteId(currentSource);

    let noteHtml;
    if (isImageTarget) {
      const imgSrc = rightClickTarget.getAttribute('src') || '';
      const imgAlt = rightClickTarget.getAttribute('alt') || '';
      const escapedSrc = imgSrc.replace(/"/g, '&quot;');
      const escapedAlt = imgAlt.replace(/"/g, '&quot;');
      const r = parseInt(color.slice(1,3), 16);
      const g = parseInt(color.slice(3,5), 16);
      const b = parseInt(color.slice(5,7), 16);
      noteHtml = `<span class="noted-image" data-note-id="${noteId}" data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:rgba(${r},${g},${b},0.15)"><img src="${escapedSrc}" alt="${escapedAlt}"></span>`;
    } else {
      noteHtml = wrapWithNoteSpan(savedSelection, noteId, escTitle, escContent, color);
    }

    if (isEditMode) {
      const editorVal = markdownEditor.value;
      const start = markdownEditor.selectionStart;
      const end = markdownEditor.selectionEnd;
      const selectedText = editorVal.substring(start, end);

      let replacement;
      if (isImageTarget) {
        replacement = noteHtml;
      } else {
        replacement = wrapWithNoteSpan(selectedText, noteId, escTitle, escContent, color);
      }

      markdownEditor.value =
        editorVal.substring(0, start) +
        replacement +
        editorVal.substring(end);

      markdownEditor.focus();
      markdownEditor.selectionStart = start;
      markdownEditor.selectionEnd = start + replacement.length;

      hasUnsavedChanges = true;
      updateUnsavedIndicator();

      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        renderMarkdown(markdownEditor.value);
      }, 300);

      showNotification(i18n('notif.noteAdded'), 1500);
    } else {
      // View mode
      const markdownContent = getActiveMarkdown();

      if (isImageTarget) {
        const imgSrc = rightClickTarget.getAttribute('src') || '';
        const imgAlt = rightClickTarget.getAttribute('alt') || '';
        let found = false;
        const mdImgPattern = `![${imgAlt}](${imgSrc})`;
        let idx = markdownContent.indexOf(mdImgPattern);
        if (idx !== -1) {
          const scrollPosition = contentWrapper.scrollTop;
          const newContent = markdownContent.substring(0, idx) + noteHtml + markdownContent.substring(idx + mdImgPattern.length);
          commitViewModeEdit(newContent, scrollPosition, () => {
            // Image src same in both — apply to originalMarkdown too
            const oi = originalMarkdown.indexOf(mdImgPattern);
            if (oi !== -1) originalMarkdown = originalMarkdown.substring(0, oi) + noteHtml + originalMarkdown.substring(oi + mdImgPattern.length);
            translateNoteAttrsToOriginal(noteId, title, content);
          });
          found = true;
        }
        if (!found) {
          const imgRegex = new RegExp(`<img[^>]*src=["']${imgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
          const match = markdownContent.match(imgRegex);
          if (match) {
            const scrollPosition = contentWrapper.scrollTop;
            const newContent = markdownContent.replace(match[0], noteHtml);
            commitViewModeEdit(newContent, scrollPosition, () => {
              const origMatch = originalMarkdown.match(imgRegex);
              if (origMatch) originalMarkdown = originalMarkdown.replace(origMatch[0], noteHtml);
              translateNoteAttrsToOriginal(noteId, title, content);
            });
            found = true;
          }
        }
        if (!found) {
          showNotification(i18n('notif.imageNotFound'), 2000);
        } else {
          showNotification(i18n('notif.noteAddedToImage'), 1500);
        }
      } else {
        const textIndex = findNthOccurrence(markdownContent, savedSelection, savedSelectionOccurrence);
        if (textIndex !== -1) {
          const scrollPosition = contentWrapper.scrollTop;
          const newContent = markdownContent.substring(0, textIndex) + noteHtml + markdownContent.substring(textIndex + savedSelection.length);
          commitViewModeEdit(newContent, scrollPosition, () => {
            syncNoteAddToOriginal(noteHtml, savedSelection, noteId, title, content, savedSelectionOccurrence);
          });
          showNotification(i18n('notif.noteAdded'), 1500);
        } else {
          showNotification(i18n('notif.textNotFound'), 2000);
        }
      }
    }
  } else {
    // ---- No selection: label badge at right-click position ----
    if (!labelName) {
      showNotification(i18n('notif.enterLabel'), 2000);
      return;
    }

    const escLabel = labelName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pos = rightClickLabelPos || { left: 100, top: 100 };
    const currentSource = isEditMode ? markdownEditor.value : getActiveMarkdown();
    const noteId = getNextNoteId(currentSource);
    const noteHtml = `<span class="note-label" data-note-id="${noteId}" data-note-title="${escTitle}" data-note-content="${escContent}" style="background-color:${color};left:${Math.round(pos.left)}px;top:${Math.round(pos.top)}px">${escLabel}</span>`;

    if (isEditMode) {
      const editorVal = markdownEditor.value;
      markdownEditor.value = editorVal + '\n' + noteHtml;

      markdownEditor.focus();
      const newPos = markdownEditor.value.length;
      markdownEditor.selectionStart = newPos;
      markdownEditor.selectionEnd = newPos;

      hasUnsavedChanges = true;
      updateUnsavedIndicator();

      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        renderMarkdown(markdownEditor.value);
      }, 300);

      showNotification(i18n('notif.noteAdded'), 1500);
    } else {
      const scrollPosition = contentWrapper.scrollTop;
      const activeContent = getActiveMarkdown();
      const newContent = activeContent + '\n' + noteHtml;
      commitViewModeEdit(newContent, scrollPosition, () => {
        // Also add label to originalMarkdown
        originalMarkdown = originalMarkdown + '\n' + noteHtml;
        translateNoteAttrsToOriginal(noteId, title, content);
      });

      showNotification(i18n('notif.noteAdded'), 1500);
    }
  }

  closeNoteDialog();
});

// Keyboard shortcut: Enter to save, Escape to close
noteDialogOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNoteDialog();
  } else if (e.key === 'Enter' && !e.shiftKey && e.target !== noteContentInput) {
    e.preventDefault();
    noteSaveBtn.click();
  }
});

// ============================================
// Find Note Feature
// ============================================

function openFindNoteDialog() {
  findNoteInput.value = '';
  findNoteOverlay.classList.add('visible');
  findNoteInput.focus();
}

function closeFindNoteDialog() {
  findNoteOverlay.classList.remove('visible');
}

ctxFindNote.addEventListener('click', () => {
  hideContextMenu();
  if (!currentFilePath) return;
  openFindNoteDialog();
});

findNoteClose.addEventListener('click', closeFindNoteDialog);
findNoteCancelBtn.addEventListener('click', closeFindNoteDialog);
findNoteOverlay.addEventListener('click', (e) => {
  if (e.target === findNoteOverlay) closeFindNoteDialog();
});

findNoteOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeFindNoteDialog();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    findNoteBtn.click();
  }
});

findNoteBtn.addEventListener('click', () => {
  const searchVal = findNoteInput.value.trim();
  if (!searchVal) {
    showNotification(i18n('notif.enterNoteId'), 2000);
    return;
  }

  let noteEl = null;
  const allNotes = viewer.querySelectorAll('.noted-text[data-note-id], .noted-image[data-note-id], .note-label[data-note-id]');

  // Try ID search first (pure number or #number)
  const idMatch = searchVal.match(/^#?(\d+)$/);
  if (idMatch) {
    noteEl = viewer.querySelector(`[data-note-id="${idMatch[1]}"]`);
  }

  // If not found by ID, search by title (case-insensitive partial match)
  if (!noteEl) {
    const searchLower = searchVal.toLowerCase();
    for (const note of allNotes) {
      const title = (note.getAttribute('data-note-title') || '').toLowerCase();
      if (title && title.includes(searchLower)) {
        noteEl = note;
        break;
      }
    }
  }

  if (!noteEl) {
    showNotification(i18n('notif.noteSearchNotFound', {val: searchVal}), 2000);
    return;
  }

  closeFindNoteDialog();

  // Scroll the note into view
  const noteRect = noteEl.getBoundingClientRect();
  const wrapperRect = contentWrapper.getBoundingClientRect();
  const scrollTarget = contentWrapper.scrollTop + noteRect.top - wrapperRect.top - (wrapperRect.height / 2);
  contentWrapper.scrollTo({ top: scrollTarget, behavior: 'smooth' });

  // Highlight the note with pulse animation
  noteEl.classList.remove('note-highlight');
  void noteEl.offsetWidth; // force reflow
  noteEl.classList.add('note-highlight');
  noteEl.addEventListener('animationend', () => {
    noteEl.classList.remove('note-highlight');
  }, { once: true });

  // Show tooltip for the found note
  setTimeout(() => {
    showNoteTooltip(noteEl, true);
  }, 400);
});

// ============================================
// Edit Text Feature (right-click edit selected text)
// ============================================

const editTextOverlay = document.getElementById('editTextOverlay');
const editTextArea = document.getElementById('editTextArea');
const editTextSaveBtn = document.getElementById('editTextSaveBtn');
const editTextCancelBtn = document.getElementById('editTextCancelBtn');
const editTextClose = document.getElementById('editTextClose');

let editTextOriginal = null; // the original selected text
let editTextOccurrence = 0;  // which occurrence

function openEditTextDialog() {
  if (!savedSelection) return;
  editTextOriginal = savedSelection;
  editTextOccurrence = savedSelectionOccurrence;
  editTextArea.value = savedSelection;
  editTextOverlay.classList.add('visible');
  editTextArea.focus();
  editTextArea.select();
}

function closeEditTextDialog() {
  editTextOverlay.classList.remove('visible');
  editTextOriginal = null;
}

ctxEditText.addEventListener('click', () => {
  hideContextMenu();
  if (!currentFilePath || !savedSelection) return;
  openEditTextDialog();
});

editTextClose.addEventListener('click', closeEditTextDialog);
editTextCancelBtn.addEventListener('click', closeEditTextDialog);
editTextOverlay.addEventListener('click', (e) => {
  if (e.target === editTextOverlay) closeEditTextDialog();
});

editTextOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditTextDialog();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    editTextSaveBtn.click();
  }
});

// Partial render: replace text in DOM without full re-render
function partialDOMReplace(container, oldText, newText, occurrence) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    let idx = 0;
    while ((idx = node.textContent.indexOf(oldText, idx)) !== -1) {
      if (count === occurrence) {
        node.textContent =
          node.textContent.substring(0, idx) +
          newText +
          node.textContent.substring(idx + oldText.length);
        return true;
      }
      count++;
      idx += oldText.length;
    }
  }
  return false;
}

// Update markdown source silently (no re-render)
function updateSourceSilently(oldText, newText, occurrence) {
  if (isShowingTranslation && translatedMarkdown) {
    const ti = findNthOccurrence(translatedMarkdown, oldText, occurrence);
    if (ti !== -1) {
      translatedMarkdown =
        translatedMarkdown.substring(0, ti) +
        newText +
        translatedMarkdown.substring(ti + oldText.length);
    }
    // Sync to originalMarkdown
    const origText = findOriginalForTranslated(oldText);
    if (origText) {
      const oi = findNthOccurrence(originalMarkdown, origText, occurrence);
      if (oi !== -1) {
        originalMarkdown = originalMarkdown.substring(0, oi) + newText + originalMarkdown.substring(oi + origText.length);
      }
    } else {
      const oi = findNthOccurrence(originalMarkdown, oldText, occurrence);
      if (oi !== -1) {
        originalMarkdown = originalMarkdown.substring(0, oi) + newText + originalMarkdown.substring(oi + oldText.length);
      }
    }
  } else {
    const ti = findNthOccurrence(originalMarkdown, oldText, occurrence);
    if (ti !== -1) {
      originalMarkdown =
        originalMarkdown.substring(0, ti) +
        newText +
        originalMarkdown.substring(ti + oldText.length);
    }
    invalidateTranslationCache();
  }
  hasUnsavedChanges = true;
  updateUnsavedIndicator();
}

editTextSaveBtn.addEventListener('click', () => {
  const newText = editTextArea.value;
  if (newText === editTextOriginal) {
    closeEditTextDialog();
    return;
  }

  if (isEditMode) {
    const editorVal = markdownEditor.value;
    const textIndex = findNthOccurrence(editorVal, editTextOriginal, editTextOccurrence);
    if (textIndex !== -1) {
      markdownEditor.value =
        editorVal.substring(0, textIndex) +
        newText +
        editorVal.substring(textIndex + editTextOriginal.length);

      hasUnsavedChanges = true;
      updateUnsavedIndicator();

      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        renderMarkdown(markdownEditor.value);
      }, 300);

      showNotification(i18n('notif.textEdited'), 1500);
    } else {
      showNotification(i18n('notif.textNotFound'), 2000);
    }
  } else {
    // View mode — try partial render first, then fall back to full re-render
    const activeSource = getActiveMarkdown();
    const textIndex = findNthOccurrence(activeSource, editTextOriginal, editTextOccurrence);
    if (textIndex === -1) {
      showNotification(i18n('notif.textNotFound'), 2000);
      closeEditTextDialog();
      return;
    }

    // Check if structural markdown change (newlines changed) — needs full re-render
    const structuralChange = newText.includes('\n') !== editTextOriginal.includes('\n');

    if (!structuralChange && partialDOMReplace(viewer, editTextOriginal, newText, editTextOccurrence)) {
      // Partial render succeeded — update source silently without re-rendering
      updateSourceSilently(editTextOriginal, newText, editTextOccurrence);
      showNotification(i18n('notif.textEdited'), 1500);
    } else {
      // Fall back to full re-render
      const scrollPosition = contentWrapper.scrollTop;
      const newContent =
        activeSource.substring(0, textIndex) +
        newText +
        activeSource.substring(textIndex + editTextOriginal.length);

      commitViewModeEdit(newContent, scrollPosition, () => {
        const origText = findOriginalForTranslated(editTextOriginal);
        if (origText) {
          const oi = findNthOccurrence(originalMarkdown, origText, editTextOccurrence);
          if (oi !== -1) {
            originalMarkdown = originalMarkdown.substring(0, oi) + newText + originalMarkdown.substring(oi + origText.length);
          }
        } else {
          const oi = findNthOccurrence(originalMarkdown, editTextOriginal, editTextOccurrence);
          if (oi !== -1) {
            originalMarkdown = originalMarkdown.substring(0, oi) + newText + originalMarkdown.substring(oi + editTextOriginal.length);
          }
        }
      });

      showNotification(i18n('notif.textEdited'), 1500);
    }
  }

  closeEditTextDialog();
});

// ============================================
// Note Tooltip (hover on noted elements)
// ============================================

let noteTooltipPinned = false;

function extractNoteColor(noted) {
  let noteColor = '#ff6600';
  const isLabel = noted.classList.contains('note-label');
  const isImage = noted.classList.contains('noted-image');
  if (isLabel) {
    const styleAttr = noted.getAttribute('style') || '';
    const bgHexMatch = styleAttr.match(/background-color:\s*(#[0-9a-fA-F]{6})/);
    if (bgHexMatch) {
      noteColor = bgHexMatch[1];
    }
  } else if (isImage) {
    const styleAttr = noted.getAttribute('style') || '';
    const rgbaMatch = styleAttr.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
      noteColor = `#${r}${g}${b}`;
    }
  } else {
    // New format: data-note-color attribute
    const dataColor = noted.getAttribute('data-note-color');
    if (dataColor) {
      noteColor = dataColor;
    } else {
      // Legacy format: inline style color:#hex
      const styleAttr = noted.getAttribute('style') || '';
      const hexMatch = styleAttr.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
      if (hexMatch) {
        noteColor = hexMatch[1];
      }
    }
  }
  return noteColor;
}

function showNoteTooltip(noted, pinned) {
  const title = noted.getAttribute('data-note-title') || '';
  const content = noted.getAttribute('data-note-content') || '';
  if (!title && !content) return;

  const noteColor = extractNoteColor(noted);
  // Convert hex to rgba with transparency
  const r = parseInt(noteColor.slice(1,3), 16);
  const g = parseInt(noteColor.slice(3,5), 16);
  const b = parseInt(noteColor.slice(5,7), 16);
  noteTooltip.style.background = `rgba(${r}, ${g}, ${b}, 0.85)`;
  noteTooltip.style.backdropFilter = 'none';
  noteTooltip.style.webkitBackdropFilter = 'none';

  const noteId = noted.getAttribute('data-note-id') || '';

  let html = '';
  if (pinned) {
    html += `<button class="note-tooltip-close" onclick="closeNoteTooltip()">&times;</button>`;
  }
  if (title) html += `<div class="note-tooltip-title">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  if (content) html += `<div class="note-tooltip-content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  if (noteId) html += `<div class="note-tooltip-id">#${noteId}</div>`;
  noteTooltip.innerHTML = html;

  noteTooltip.style.left = '50%';
  noteTooltip.style.transform = 'translateX(-50%)';
  noteTooltip.style.bottom = '30px';
  noteTooltip.style.top = 'auto';

  noteTooltipPinned = pinned;
  noteTooltip.style.pointerEvents = pinned ? 'auto' : 'none';
  noteTooltip.classList.add('visible');
}

window.closeNoteTooltip = function() {
  noteTooltipPinned = false;
  noteTooltip.style.pointerEvents = 'none';
  noteTooltip.classList.remove('visible');
};

// Hover: show tooltip (not pinned)
viewer.addEventListener('mouseover', (e) => {
  if (noteTooltipPinned) return;
  if (!notesVisible) return;
  const noted = e.target.closest('.noted-text, .noted-image, .note-label');
  if (!noted) return;
  showNoteTooltip(noted, false);
});

viewer.addEventListener('mouseout', (e) => {
  if (noteTooltipPinned) return;
  const noted = e.target.closest('.noted-text, .noted-image, .note-label');
  if (!noted) return;
  const relatedTarget = e.relatedTarget;
  if (relatedTarget && noted.contains(relatedTarget)) return;
  noteTooltip.classList.remove('visible');
});

// Click: pin tooltip on screen
viewer.addEventListener('click', (e) => {
  if (!notesVisible) return;
  const noted = e.target.closest('.noted-text, .noted-image, .note-label');
  if (!noted) return;
  // Don't pin if clicking a link inside the note
  if (e.target.closest('a')) return;
  e.preventDefault();
  showNoteTooltip(noted, true);
});

// Also hide tooltip on scroll (only if not pinned)
contentWrapper.addEventListener('scroll', () => {
  if (!noteTooltipPinned) {
    noteTooltip.classList.remove('visible');
  }
}, { passive: true });

// Insert Image
ctxInsertImage.addEventListener('click', () => {
  hideContextMenu();
  if (!currentFilePath) {
    showNotification(i18n('notif.openFileFirst'), 2000);
    return;
  }
  pendingSliderImageAdd = false;
  ipcRenderer.send('open-image-dialog');
});

// Find insertion position for label based on exact right-click caret position
function getInsertPositionForLabel() {
  const markdownContent = originalMarkdown;

  // Use the captured caret info from right-click for precise placement
  if (rightClickCaretInfo) {
    const { textBefore, textAfter } = rightClickCaretInfo;

    // Try matching with surrounding context (before + after the caret)
    // Use increasingly shorter context to find best match
    for (let contextLen = Math.min(textBefore.length, textAfter.length); contextLen >= 3; contextLen--) {
      const before = textBefore.substring(textBefore.length - contextLen);
      const after = textAfter.substring(0, contextLen);
      const searchPattern = before + after;
      const idx = markdownContent.indexOf(searchPattern);
      if (idx !== -1) {
        // Verify uniqueness - if multiple matches, try longer context
        const secondIdx = markdownContent.indexOf(searchPattern, idx + 1);
        if (secondIdx === -1 || contextLen <= 3) {
          return idx + before.length;
        }
      }
    }

    // Try just textBefore for end-of-line scenarios
    if (textBefore.length >= 3) {
      const idx = markdownContent.indexOf(textBefore);
      if (idx !== -1) {
        return idx + textBefore.length;
      }
    }

    // Try just textAfter for start-of-line scenarios
    if (textAfter.length >= 3) {
      const idx = markdownContent.indexOf(textAfter);
      if (idx !== -1) {
        return idx;
      }
    }
  }

  // If text is selected, insert after the selection in the source
  if (savedSelection) {
    const textIndex = findNthOccurrence(markdownContent, savedSelection, savedSelectionOccurrence);
    if (textIndex !== -1) {
      return textIndex + savedSelection.length;
    }
  }

  // Fallback: use Y-coordinate based insertion
  return getMarkdownInsertPosition();
}

// Build an array of {start, end} positions for each marked.js top-level token in md
function getTokenPositions(md) {
  let tokens;
  try { tokens = marked.lexer(md); } catch (e) { return []; }
  const positions = [];
  let scanPos = 0;
  for (const token of tokens) {
    const raw = token.raw;
    if (!raw) continue;
    const idx = md.indexOf(raw, scanPos);
    if (idx === -1) continue;
    positions.push({ start: idx, end: idx + raw.length });
    scanPos = idx + raw.length;
  }
  return positions;
}

// Find insertion position in markdown based on right-click Y coordinate (view mode)
// Uses marked.js token positions for accurate DOM-child → markdown-block mapping.
function getMarkdownInsertPosition() {
  const md = getActiveMarkdown();
  if (!md) return 0;

  const children = Array.from(viewer.children);
  if (children.length === 0) return md.length;

  // Find which viewer child element is at (or just below) the right-click Y position
  let targetChildIndex = children.length - 1;
  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (rect.bottom >= rightClickY) {
      targetChildIndex = i;
      break;
    }
  }

  // Map DOM child index → markdown token end position
  const tokenPositions = getTokenPositions(md);
  if (tokenPositions.length > 0) {
    const tokenIndex = Math.min(targetChildIndex, tokenPositions.length - 1);
    return tokenPositions[tokenIndex].end;
  }

  // Fallback: proportional Y-coordinate
  const viewerRect = viewer.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (rightClickY - viewerRect.top) / viewerRect.height));
  return Math.floor(ratio * md.length);
}

// Find block-level insertion position for mermaid/table inserts.
// Priority: (1) marked lexer token positions via DOM child index,
//           (2) proportional Y-coordinate fallback.
function getBlockInsertPosition() {
  const md = getActiveMarkdown();
  if (!md) return 0;

  const children = Array.from(viewer.children);
  if (children.length === 0) return md.length;

  // Find which viewer child is at the right-click Y
  let targetChildIndex = children.length - 1;
  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (rect.bottom >= rightClickY) {
      targetChildIndex = i;
      break;
    }
  }

  // Use marked.js token positions for accurate mapping
  const tokenPositions = getTokenPositions(md);
  if (tokenPositions.length > 0) {
    const tokenIndex = Math.min(targetChildIndex, tokenPositions.length - 1);
    return tokenPositions[tokenIndex].end;
  }

  // Fallback
  const viewerRect = viewer.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (rightClickY - viewerRect.top) / viewerRect.height));
  return Math.floor(ratio * md.length);
}

// Format byte size to human readable string
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Insert image markdown into document at the right position
function insertImageMarkdown(imageMarkdown, originalSize, compressedSize) {
  if (isEditMode) {
    // Edit mode: insert at saved cursor position
    const cursorPos = savedCursorPosition !== null ? savedCursorPosition : markdownEditor.selectionStart;
    const before = markdownEditor.value.substring(0, cursorPos);
    const after = markdownEditor.value.substring(cursorPos);

    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';

    markdownEditor.value = before + prefix + imageMarkdown + suffix + after;

    const newPos = cursorPos + prefix.length + imageMarkdown.length + suffix.length;
    markdownEditor.focus();
    markdownEditor.selectionStart = newPos;
    markdownEditor.selectionEnd = newPos;

    hasUnsavedChanges = true;
    updateUnsavedIndicator();

    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      renderMarkdown(markdownEditor.value);
    }, PREVIEW_DEBOUNCE_DELAY);
  } else {
    // View mode: if right-clicked on a data-URI image, create/extend a slider
    const clickedImg = rightClickTarget && (
      rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img')
    );
    if (clickedImg && clickedImg.src && clickedImg.src.startsWith('data:')) {
      const altText = clickedImg.alt || '';
      const srcPrefix = clickedImg.src.substring(0, 50);
      const searchStart = `![${altText}](${srcPrefix}`;
      const content = originalMarkdown;
      const imgIdx = content.indexOf(searchStart);
      if (imgIdx !== -1) {
        const imgEndIdx = content.indexOf(')', imgIdx + searchStart.length);
        if (imgEndIdx !== -1) {
          const beforeImg = content.substring(0, imgIdx);
          const afterImg = content.substring(imgEndIdx + 1);
          const lastSliderStart = beforeImg.lastIndexOf('<!-- slider-start -->');
          const lastSliderEndBeforeImg = beforeImg.lastIndexOf('<!-- slider-end -->');

          if (lastSliderStart !== -1 && lastSliderStart > lastSliderEndBeforeImg) {
            // Image is already in a slider — add the new image inside it
            const sliderEndAfter = afterImg.indexOf('<!-- slider-end -->');
            if (sliderEndAfter !== -1) {
              const sliderContent = content.substring(lastSliderStart, imgEndIdx + 1 + sliderEndAfter + '<!-- slider-end -->'.length);
              const existingImages = (sliderContent.match(/!\[[^\]]*\]\([^)]+\)/g) || []);
              if (existingImages.length >= 5) {
                showNotification(i18n('ctx.addToSlider') + ': max 5 images', 2000);
                return;
              }
              applySliderImageAdd(imageMarkdown, imgEndIdx + 1);
              return;
            }
          } else {
            // Image is NOT in a slider — wrap both in a new slider block
            historyPush(originalMarkdown);
            const fullImgMd = content.substring(imgIdx, imgEndIdx + 1);
            const newContent = content.substring(0, imgIdx)
              + '<!-- slider-start -->\n' + fullImgMd + '\n' + imageMarkdown + '\n<!-- slider-end -->'
              + content.substring(imgEndIdx + 1);
            const scrollPosition = contentWrapper.scrollTop;
            originalMarkdown = newContent;
            invalidateTranslationCache();
            renderMarkdown(originalMarkdown, 'full').then(() => {
              contentWrapper.scrollTop = scrollPosition;
            });
            hasUnsavedChanges = true;
            showNotification('Slider created', 1500);
            return;
          }
        }
      }
    }

    // Standard insert: place after the clicked element's position in markdown
    const scrollPosition = contentWrapper.scrollTop;
    const activeContent = getActiveMarkdown();
    const insertPos = getMarkdownInsertPosition();
    const before = activeContent.substring(0, insertPos);
    const after = activeContent.substring(insertPos);
    const newContent = before + '\n' + imageMarkdown + '\n' + after;

    commitViewModeEdit(newContent, scrollPosition, () => {
      // Also insert image into originalMarkdown at similar position
      const origInsertPos = Math.min(insertPos, originalMarkdown.length);
      const origBefore = originalMarkdown.substring(0, origInsertPos);
      const origAfter = originalMarkdown.substring(origInsertPos);
      originalMarkdown = origBefore + '\n' + imageMarkdown + '\n' + origAfter;
    });
  }

  if (originalSize && compressedSize) {
    showNotification(i18n('notif.imageInsertedCompressed', {from: formatFileSize(originalSize), to: formatFileSize(compressedSize)}), 3000);
  } else {
    showNotification(i18n('notif.imageInserted'), 1500);
  }
}

// Handle image selected from main process
ipcRenderer.on('image-selected', (event, data) => {
  // If the dialog was opened by "Add to Slider", skip here — handled by the once() listener
  if (pendingSliderImageAdd) {
    pendingSliderImageAdd = false;
    return;
  }
  if (data.error) {
    showNotification(i18n('notif.imageFailed') + data.error, 3000);
    return;
  }

  const { base64, mimeType, fileName } = data;

  // Original file size (base64 is ~33% larger than binary, so estimate original)
  const originalSize = Math.round(base64.length * 3 / 4);

  // SVG: embed directly, no resize needed
  if (mimeType === 'image/svg+xml') {
    const imageMarkdown = `![${fileName}](data:${mimeType};base64,${base64})`;
    insertImageMarkdown(imageMarkdown, originalSize, originalSize);
    return;
  }

  // For raster images: resize to max 1000x1000 using Canvas
  const img = new Image();
  img.onload = () => {
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (w > 1000 || h > 1000) {
      const scale = Math.min(1000 / w, 1000 / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/webp', 0.70);

    // Compressed size: dataUrl contains "data:image/webp;base64," prefix + base64 data
    const compressedBase64 = dataUrl.split(',')[1];
    const compressedSize = Math.round(compressedBase64.length * 3 / 4);

    const imageMarkdown = `![${fileName}](${dataUrl})`;
    insertImageMarkdown(imageMarkdown, originalSize, compressedSize);
  };

  img.onerror = () => {
    showNotification(i18n('notif.imageProcessFailed'), 3000);
  };

  img.src = `data:${mimeType};base64,${base64}`;
});

// Delete Image
ctxDeleteImage.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget || !currentFilePath) return;

  // Find the img element
  const imgEl = rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img');
  if (!imgEl || !imgEl.src || !imgEl.src.startsWith('data:')) return;

  const altText = imgEl.alt || '';
  // Build a search pattern: ![alt](data:...)
  const searchStart = `![${altText}](${imgEl.src.substring(0, 50)}`;

  if (isEditMode) {
    const content = markdownEditor.value;
    const startIdx = content.indexOf(searchStart);
    if (startIdx === -1) {
      showNotification(i18n('notif.imageNotFound'), 2000);
      return;
    }
    // Find the closing )
    const endIdx = content.indexOf(')', startIdx + searchStart.length);
    if (endIdx === -1) return;

    // Remove the image markdown and surrounding empty lines
    let removeStart = startIdx;
    let removeEnd = endIdx + 1;
    // Clean up leading newline
    if (removeStart > 0 && content[removeStart - 1] === '\n') removeStart--;
    // Clean up trailing newline
    if (removeEnd < content.length && content[removeEnd] === '\n') removeEnd++;

    markdownEditor.value = content.substring(0, removeStart) + content.substring(removeEnd);

    hasUnsavedChanges = true;
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      renderMarkdown(markdownEditor.value);
    }, PREVIEW_DEBOUNCE_DELAY);
  } else {
    // View mode
    const content = getActiveMarkdown();
    const startIdx = content.indexOf(searchStart);
    if (startIdx === -1) {
      showNotification(i18n('notif.imageNotFound'), 2000);
      return;
    }
    const endIdx = content.indexOf(')', startIdx + searchStart.length);
    if (endIdx === -1) return;

    let removeStart = startIdx;
    let removeEnd = endIdx + 1;
    if (removeStart > 0 && content[removeStart - 1] === '\n') removeStart--;
    if (removeEnd < content.length && content[removeEnd] === '\n') removeEnd++;

    const scrollPosition = contentWrapper.scrollTop;
    const newContent = content.substring(0, removeStart) + content.substring(removeEnd);
    commitViewModeEdit(newContent, scrollPosition, () => {
      // Also delete from originalMarkdown (same image pattern)
      const origStartIdx = originalMarkdown.indexOf(searchStart);
      if (origStartIdx !== -1) {
        const origEndIdx = originalMarkdown.indexOf(')', origStartIdx + searchStart.length);
        if (origEndIdx !== -1) {
          let oRemoveStart = origStartIdx;
          let oRemoveEnd = origEndIdx + 1;
          if (oRemoveStart > 0 && originalMarkdown[oRemoveStart - 1] === '\n') oRemoveStart--;
          if (oRemoveEnd < originalMarkdown.length && originalMarkdown[oRemoveEnd] === '\n') oRemoveEnd++;
          originalMarkdown = originalMarkdown.substring(0, oRemoveStart) + originalMarkdown.substring(oRemoveEnd);
        }
      }
    });
  }

  showNotification(i18n('notif.imageDeleted'), 1500);
});

// ============================================
// NEW CONTEXT MENU ITEMS
// ============================================

const ctxInsertMermaid = document.getElementById('ctxInsertMermaid');
const ctxInsertTable = document.getElementById('ctxInsertTable');
const ctxEditMermaid = document.getElementById('ctxEditMermaid');
const ctxEditTable = document.getElementById('ctxEditTable');
const ctxDeleteMermaid = document.getElementById('ctxDeleteMermaid');
const ctxDeleteTable = document.getElementById('ctxDeleteTable');
const ctxCopyCode = document.getElementById('ctxCopyCode');
const ctxCopyImageSrc = document.getElementById('ctxCopyImageSrc');
const ctxAddToSlider = document.getElementById('ctxAddToSlider');

// Copy Image Source (base64 data URL)
ctxCopyImageSrc && ctxCopyImageSrc.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget) return;
  const imgEl = rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img');
  if (imgEl && imgEl.src) {
    clipboard.writeText(imgEl.src);
    showNotification(i18n('notif.copied'), 1500);
  }
});

// Copy Code block content
ctxCopyCode && ctxCopyCode.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget) return;
  const codeEl = rightClickTarget.closest('pre')?.querySelector('code') ||
                 rightClickTarget.closest('code') ||
                 (rightClickTarget.tagName === 'CODE' ? rightClickTarget : null);
  if (codeEl) {
    clipboard.writeText(codeEl.textContent);
    showNotification(i18n('notif.copied'), 1500);
  }
});

// Add to Slider — create or expand a slider around the right-clicked image (max 5 images)
ctxAddToSlider && ctxAddToSlider.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget || !currentFilePath) return;

  const imgEl = rightClickTarget.tagName === 'IMG' ? rightClickTarget : rightClickTarget.closest?.('img');
  if (!imgEl || !imgEl.src) return;

  const altText = imgEl.alt || '';
  // Build the markdown image pattern to find in source (first 50 chars of src for data URIs)
  const srcPrefix = imgEl.src.substring(0, 50);
  const searchStart = `![${altText}](${srcPrefix}`;

  const content = isEditMode ? markdownEditor.value : originalMarkdown;
  const imgIdx = content.indexOf(searchStart);
  if (imgIdx === -1) {
    showNotification(i18n('notif.imageNotFound'), 2000);
    return;
  }

  // Find full image markdown: ![alt](src)
  const imgEndIdx = content.indexOf(')', imgIdx + searchStart.length);
  if (imgEndIdx === -1) return;
  const fullImgMd = content.substring(imgIdx, imgEndIdx + 1);

  // Check if this image is already inside a slider block
  const beforeImg = content.substring(0, imgIdx);
  const afterImg = content.substring(imgEndIdx + 1);
  const lastSliderStart = beforeImg.lastIndexOf('<!-- slider-start -->');
  const lastSliderEndBeforeImg = beforeImg.lastIndexOf('<!-- slider-end -->');

  if (lastSliderStart !== -1 && lastSliderStart > lastSliderEndBeforeImg) {
    // Image is already inside a slider — check if we can add another image
    const sliderEndAfter = afterImg.indexOf('<!-- slider-end -->');
    if (sliderEndAfter !== -1) {
      const sliderContent = content.substring(lastSliderStart, imgEndIdx + 1 + sliderEndAfter + '<!-- slider-end -->'.length);
      const existingImages = (sliderContent.match(/!\[[^\]]*\]\([^)]+\)/g) || []);
      if (existingImages.length >= 5) {
        showNotification(i18n('ctx.addToSlider') + ': max 5 images', 2000);
        return;
      }
      // Open image dialog to add a new image to this slider
      pendingSliderImageAdd = true;
      ipcRenderer.send('open-image-dialog');
      // We'll insert the new image right after the current one
      ipcRenderer.once('image-selected', (event, data) => {
        if (data.error) {
          showNotification(i18n('notif.imageFailed') + data.error, 3000);
          return;
        }
        const { base64, mimeType, fileName: fn } = data;
        let newImgMd;
        if (mimeType === 'image/svg+xml') {
          newImgMd = `![${fn}](data:${mimeType};base64,${base64})`;
        } else {
          // Compress to WebP like standard image insertion
          const tmpImg = new Image();
          tmpImg.onload = () => {
            let w = tmpImg.naturalWidth, h = tmpImg.naturalHeight;
            if (w > 1000 || h > 1000) {
              const scale = Math.min(1000 / w, 1000 / h);
              w = Math.round(w * scale); h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(tmpImg, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/webp', 0.70);
            newImgMd = `![${fn}](${dataUrl})`;
            applySliderImageAdd(newImgMd, imgEndIdx + 1);
          };
          tmpImg.src = `data:${mimeType};base64,${base64}`;
          return; // wait for onload
        }
        applySliderImageAdd(newImgMd, imgEndIdx + 1);
      });
      return;
    }
  }

  // Image is NOT in a slider — wrap it in a new slider block
  historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

  // Find the full line range of the image (including leading/trailing newlines)
  let wrapStart = imgIdx;
  let wrapEnd = imgEndIdx + 1;

  const newContent = content.substring(0, wrapStart)
    + '<!-- slider-start -->\n' + fullImgMd + '\n<!-- slider-end -->'
    + content.substring(wrapEnd);

  if (isEditMode) {
    markdownEditor.value = newContent;
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => renderMarkdown(markdownEditor.value), TIMING.previewDebounceDelay);
  } else {
    const scrollPosition = contentWrapper.scrollTop;
    originalMarkdown = newContent;
    invalidateTranslationCache();
    renderMarkdown(originalMarkdown, 'full').then(() => {
      contentWrapper.scrollTop = scrollPosition;
    });
    hasUnsavedChanges = true;
  }
  showNotification('Slider created', 1500);
});

// Helper: add an image markdown string to the slider at the given position
function applySliderImageAdd(newImgMd, insertPos) {
  historyPush(isEditMode ? markdownEditor.value : originalMarkdown);
  const content = isEditMode ? markdownEditor.value : originalMarkdown;
  const newContent = content.substring(0, insertPos) + '\n' + newImgMd + content.substring(insertPos);

  if (isEditMode) {
    markdownEditor.value = newContent;
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => renderMarkdown(markdownEditor.value), TIMING.previewDebounceDelay);
  } else {
    const scrollPosition = contentWrapper.scrollTop;
    originalMarkdown = newContent;
    invalidateTranslationCache();
    renderMarkdown(originalMarkdown, 'full').then(() => {
      contentWrapper.scrollTop = scrollPosition;
    });
    hasUnsavedChanges = true;
  }
  showNotification('Image added to slider', 1500);
}

// Insert Mermaid → open MermaidTemplateDialog
ctxInsertMermaid && ctxInsertMermaid.addEventListener('click', () => {
  hideContextMenu();
  openMermaidTemplateDialog();
});

// Insert Table → open TableInsertDialog
ctxInsertTable && ctxInsertTable.addEventListener('click', () => {
  hideContextMenu();
  openTableInsertDialog();
});

// Edit Mermaid — open dialog prefilled with existing code
ctxEditMermaid && ctxEditMermaid.addEventListener('click', () => {
  hideContextMenu();
  const mermaidEl = rightClickTarget?.closest('.mermaid-container')?.querySelector('.mermaid')
    || rightClickTarget?.closest('.mermaid');
  if (!mermaidEl) return;
  editingMermaidContainer = mermaidEl.closest('.mermaid-container') || mermaidEl.parentElement;
  openMermaidTemplateDialog(mermaidEl.dataset.mermaidSrc?.trim() || '', 'edit');
});

// Edit Table — open dialog prefilled with the matched markdown source
ctxEditTable && ctxEditTable.addEventListener('click', () => {
  hideContextMenu();
  const tableEl = rightClickTarget?.closest('table');
  if (!tableEl) return;
  editingTableEl = tableEl;

  const content = isEditMode ? markdownEditor.value : originalMarkdown;
  const headers = [...tableEl.querySelectorAll('th')].map(th => th.textContent.trim());
  const cellTexts = [...tableEl.querySelectorAll('td')].map(td => td.textContent.trim());

  const tableRegex = /(\|[^\n]+\|[ \t]*\n)+\|[^\n]+\|[ \t]*(?:\n|$)/g;
  let m;
  let bestMatchText = null;
  let bestScore = -1;

  while ((m = tableRegex.exec(content)) !== null) {
    const tableText = m[0];
    const firstLine = tableText.split('\n').filter(l => l.trim())[0] || '';
    let score = 0;
    for (const h of headers) { if (firstLine.includes(h)) score += 2; }
    for (const c of cellTexts.slice(0, 6)) { if (tableText.includes(c)) score++; }
    if (score > bestScore) { bestScore = score; bestMatchText = tableText; }
  }

  openTableInsertDialog(bestMatchText || '', 'edit');
});

// Delete Mermaid — remove mermaid block from source
ctxDeleteMermaid && ctxDeleteMermaid.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget) return;

  const mermaidEl = rightClickTarget.closest('.mermaid-container')?.querySelector('.mermaid')
    || rightClickTarget.closest('.mermaid');
  if (!mermaidEl) {
    showNotification('Could not find mermaid element', 2000);
    return;
  }

  // Collect text samples from the SVG to identify the block
  const svgTexts = [];
  mermaidEl.querySelectorAll('text, tspan').forEach(el => {
    const t = el.textContent.trim();
    if (t && t.length > 1) svgTexts.push(t);
  });

  deleteMermaidFromSource(svgTexts, mermaidEl);
});

// Normalize line endings and trim for reliable mermaid source comparison
function normalizeMermaidCode(s) {
  return (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function deleteMermaidFromSource(svgTexts, mermaidEl) {
  const content = isEditMode ? markdownEditor.value : originalMarkdown;
  const blocks = [];
  // Allow optional spaces/tabs before the newline after ```mermaid, and one or more newlines
  const mermaidBlockRegex = /```mermaid[^\S\r\n]*[\r\n]+([\s\S]*?)```/g;
  let m;
  while ((m = mermaidBlockRegex.exec(content)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, code: m[1] });
  }

  if (blocks.length === 0) {
    showNotification('Could not find mermaid block in source', 2000);
    return;
  }

  let bestBlock = null;
  if (blocks.length === 1) {
    bestBlock = blocks[0];
  } else {
    // Priority 1: match via data-mermaid-src (normalize line endings before comparing)
    const srcCode = normalizeMermaidCode(mermaidEl?.dataset?.mermaidSrc);
    if (srcCode) {
      bestBlock = blocks.find(b => normalizeMermaidCode(b.code) === srcCode) || null;
    }

    // Priority 2: text-sample scoring (SVG text nodes vs source code)
    if (!bestBlock) {
      let bestScore = -1;
      for (const block of blocks) {
        const blockLower = block.code.toLowerCase();
        let score = 0;
        const pieMatches = [...block.code.matchAll(/"([^"]+)"/g)].map(x => x[1]);
        for (const sample of svgTexts.slice(0, 8)) {
          const sLower = sample.toLowerCase().replace(/[\d.%]+/g, '').trim();
          if (sLower.length >= 2 && blockLower.includes(sLower)) score++;
          if (pieMatches.some(pm => pm.toLowerCase() === sample.toLowerCase())) score += 3;
        }
        if (score > bestScore) { bestScore = score; bestBlock = block; }
      }
      if (bestScore < 1) {
        showNotification('Could not uniquely identify mermaid block', 2000);
        return;
      }
    }
  }

  if (!bestBlock) return;

  // Remove from DOM directly (no full re-render)
  const container = mermaidEl?.closest('.mermaid-container') || mermaidEl?.parentElement;
  if (container && container.parentElement) {
    container.parentElement.removeChild(container);
  }

  // Update source
  let removeStart = bestBlock.start;
  let removeEnd = bestBlock.end;
  if (removeStart > 0 && content[removeStart - 1] === '\n') removeStart--;
  if (removeEnd < content.length && content[removeEnd] === '\n') removeEnd++;

  const newContent = content.substring(0, removeStart) + content.substring(removeEnd);
  historyPush(originalMarkdown);
  originalMarkdown = isEditMode ? originalMarkdown : newContent;
  if (isEditMode) {
    markdownEditor.value = newContent;
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
  }
  invalidateTranslationCache();
  syncEditorWithStore();
  showNotification('Mermaid diagram deleted', 1500);
}

// Delete Table — remove markdown table from source
ctxDeleteTable && ctxDeleteTable.addEventListener('click', () => {
  hideContextMenu();
  if (!rightClickTarget) return;

  const tableEl = rightClickTarget.closest('table');
  if (!tableEl) {
    showNotification('Could not find table element', 2000);
    return;
  }

  // Collect all cell texts (header + body) for matching
  const headers = [];
  tableEl.querySelectorAll('th').forEach(th => {
    const t = th.textContent.trim();
    if (t) headers.push(t);
  });
  const cellTexts = [];
  tableEl.querySelectorAll('td').forEach(td => {
    const t = td.textContent.trim();
    if (t) cellTexts.push(t);
  });

  deleteTableFromSource(tableEl, headers, cellTexts);
});

function deleteTableFromSource(tableEl, headers, cellTexts = []) {
  const content = isEditMode ? markdownEditor.value : originalMarkdown;
  // Match markdown table rows: lines starting with | (last \n optional for end-of-file)
  const tableRegex = /(\|[^\n]+\|[ \t]*\n)+\|[^\n]+\|[ \t]*(?:\n|$)/g;
  let m;
  let bestMatch = null;
  let bestScore = -1;

  while ((m = tableRegex.exec(content)) !== null) {
    const tableText = m[0];
    const lines = tableText.split('\n').filter(l => l.trim());
    const firstLine = lines[0] || '';
    let score = 0;
    for (const h of headers) {
      if (firstLine.includes(h)) score += 2;
    }
    for (const c of cellTexts.slice(0, 6)) {
      if (tableText.includes(c)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { start: m.index, end: m.index + m[0].length };
    }
  }

  if (!bestMatch) {
    showNotification('Could not find table in source', 2000);
    return;
  }

  // Remove from DOM directly — remove the .table-container wrapper if present, not just the <table>
  const tableContainerToRemove = tableEl.parentElement?.classList.contains('table-container')
    ? tableEl.parentElement
    : tableEl;
  if (tableContainerToRemove.parentElement) {
    tableContainerToRemove.parentElement.removeChild(tableContainerToRemove);
  }

  // Update source
  let removeStart = bestMatch.start;
  let removeEnd = bestMatch.end;
  if (removeStart > 0 && content[removeStart - 1] === '\n') removeStart--;
  if (removeEnd < content.length && content[removeEnd] === '\n') removeEnd++;

  const newTableContent = content.substring(0, removeStart) + content.substring(removeEnd);
  historyPush(originalMarkdown);
  originalMarkdown = isEditMode ? originalMarkdown : newTableContent;
  if (isEditMode) {
    markdownEditor.value = newTableContent;
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
  }
  invalidateTranslationCache();
  syncEditorWithStore();
  showNotification('Table deleted', 1500);
}

// Update context menu visibility based on right-click target
const _origShowContextMenu = showContextMenu;
// Override context menu show to toggle new items
function updateNewContextMenuItems() {
  const target = rightClickTarget;
  if (!target) return;

  const isMermaid = !!(target.closest?.('.mermaid-container') || target.closest?.('.mermaid'));
  const isTable = !!target.closest?.('table');
  const isCode = !!(target.closest?.('pre') || target.closest?.('code'));
  const isImg = target.tagName === 'IMG' || !!target.closest?.('img');

  ctxEditMermaid && (ctxEditMermaid.style.display = isMermaid ? '' : 'none');
  ctxEditTable && (ctxEditTable.style.display = isTable ? '' : 'none');
  ctxDeleteMermaid && (ctxDeleteMermaid.style.display = isMermaid ? '' : 'none');
  ctxDeleteTable && (ctxDeleteTable.style.display = isTable ? '' : 'none');
  ctxCopyCode && (ctxCopyCode.style.display = isCode ? '' : 'none');
  ctxCopyImageSrc && (ctxCopyImageSrc.style.display = isImg ? '' : 'none');

  // Show "Add to Slider" for images with data: src (same condition as delete image)
  const imgForSlider = isImg && (target.tagName === 'IMG' ? target : target.closest?.('img'));
  const hasDataSrc = imgForSlider && imgForSlider.src && imgForSlider.src.startsWith('data:');
  ctxAddToSlider && (ctxAddToSlider.style.display = hasDataSrc ? '' : 'none');
}

// ============================================
// DOM PATCH HELPERS
// ============================================

// Returns the direct child of viewer at the right-click Y position (mirrors getBlockInsertPosition logic)
function getDomInsertAnchor() {
  const children = Array.from(viewer.children);
  if (children.length === 0) return null;
  let targetIndex = children.length - 1;
  for (let i = 0; i < children.length; i++) {
    if (children[i].getBoundingClientRect().bottom >= rightClickY) {
      targetIndex = i;
      break;
    }
  }
  return children[targetIndex] || null;
}

// Render a mermaid diagram directly into the DOM without a full page re-render.
// mode='insert': inserts after the right-click anchor child of viewer
// mode='replace': replaces replaceTarget (a .mermaid-container element)
async function renderMermaidInDOM(code, mode, replaceTarget) {
  const mermaidEl = document.createElement('div');
  mermaidEl.className = 'mermaid';
  mermaidEl.textContent = code;
  mermaidEl.dataset.mermaidSrc = code;
  mermaidEl.id = `mermaid-${Date.now()}-patch`;

  const container = document.createElement('div');
  container.className = 'mermaid-container';
  container.appendChild(mermaidEl);

  const maxBtn = document.createElement('button');
  maxBtn.className = 'mermaid-maximize-btn';
  maxBtn.title = 'Open in new window';
  maxBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
  </svg>`;
  maxBtn.addEventListener('click', () => {
    const svg = mermaidEl.querySelector('svg');
    if (svg) {
      ipcRenderer.send('open-mermaid-popup', { svgContent: svg.outerHTML, isDarkMode: document.body.classList.contains('dark-mode') });
    }
  });
  container.appendChild(maxBtn);

  if (mode === 'replace') {
    replaceTarget.parentElement.replaceChild(container, replaceTarget);
  } else {
    const anchor = getDomInsertAnchor();
    if (anchor && anchor.parentElement === viewer) {
      viewer.insertBefore(container, anchor.nextSibling);
    } else {
      viewer.appendChild(container);
    }
  }

  try {
    await mermaid.run({ nodes: [mermaidEl], suppressErrors: false });
    if (mermaidEl.querySelector('svg')) {
      mermaidSvgCache.set(code, mermaidEl.innerHTML);
    }
  } catch (err) {
    mermaidEl.innerHTML = `<div style="color:red;padding:20px;background:#ffe6e6;border:1px solid #ff0000;border-radius:4px;">
      <strong>Mermaid Rendering Error:</strong><br>${err.message}
    </div>`;
  }
}

// Render a markdown table directly into the DOM without a full page re-render.
// mode='insert': inserts after the right-click anchor child of viewer
// mode='replace': replaces replaceTarget (<table> element, parent .table-container used if present)
function renderTableInDOM(mdTable, mode, replaceTarget) {
  const html = DOMPurify.sanitize(marked.parse(mdTable));
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const tableEl = tempDiv.querySelector('table');
  if (!tableEl) return;

  const firstRow = tableEl.querySelector('thead tr, tr:first-child');
  if (firstRow && firstRow.querySelectorAll('th, td').length > 5) {
    tableEl.classList.add('compact-table');
  }

  const container = document.createElement('div');
  container.className = 'table-container';
  container.appendChild(tableEl);

  const maxBtn = document.createElement('button');
  maxBtn.className = 'table-maximize-btn';
  maxBtn.title = 'Open in interactive popup';
  maxBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
  </svg>`;
  maxBtn.addEventListener('click', () => {
    ipcRenderer.send('open-table-popup', { tableData: extractTableData(tableEl), isDarkMode: document.body.classList.contains('dark-mode') });
  });
  container.appendChild(maxBtn);

  if (mode === 'replace') {
    const replaceEl = replaceTarget.parentElement?.classList.contains('table-container')
      ? replaceTarget.parentElement
      : replaceTarget;
    if (replaceEl.parentElement) replaceEl.parentElement.replaceChild(container, replaceEl);
  } else {
    const anchor = getDomInsertAnchor();
    if (anchor && anchor.parentElement === viewer) {
      viewer.insertBefore(container, anchor.nextSibling);
    } else {
      viewer.appendChild(container);
    }
  }
}

// ============================================
// MERMAID TEMPLATE DIALOG
// ============================================

// Dialog mode state (shared between mermaid and table dialogs)
let mermaidDialogMode = 'insert'; // 'insert' | 'edit'
let editingMermaidContainer = null;
let tableDialogMode = 'insert';   // 'insert' | 'edit'
let editingTableEl = null;

const MERMAID_TEMPLATES = {
  flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E`,
  sequence: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hello Alice!
    A->>B: How are you?
    B-->>A: I'm good, thanks!`,
  class: `classDiagram
    class Animal {
      +String name
      +int age
      +makeSound()
    }
    class Dog {
      +String breed
      +bark()
    }
    Animal <|-- Dog`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Done : Complete
    Processing --> Error : Fail
    Done --> [*]
    Error --> Idle : Retry`,
  er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int orderNumber
        date createdAt
    }`,
  gantt: `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements   :a1, 2024-01-01, 7d
    Design         :a2, after a1, 5d
    section Development
    Implementation :b1, after a2, 14d
    Testing        :b2, after b1, 7d`,
  pie: `pie title Distribution
    "Category A" : 40
    "Category B" : 30
    "Category C" : 20
    "Category D" : 10`,
  gitgraph: `gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit`,
  timeline: `timeline
    title Project Milestones
    section Q1
      January : Kickoff meeting
      February : Requirements done
    section Q2
      March : Design approved
      April : Development starts
    section Q3
      August : Beta release`,
  mindmap: `mindmap
  root((Project))
    Planning
      Requirements
      Timeline
      Budget
    Development
      Frontend
      Backend
      Database
    Testing
      Unit Tests
      Integration
      UAT`,
  xychart: `xychart-beta
  title "Quarterly Revenue"
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Revenue (M)" 0 --> 120
  bar [45, 62, 78, 91]
  line [45, 62, 78, 91]`,
  quadrant: `quadrantChart
  title Effort vs Impact
  x-axis Low Effort --> High Effort
  y-axis Low Impact --> High Impact
  quadrant-1 Quick Wins
  quadrant-2 Major Projects
  quadrant-3 Fill Ins
  quadrant-4 Thankless Tasks
  Task A: [0.25, 0.75]
  Task B: [0.65, 0.60]
  Task C: [0.20, 0.30]
  Task D: [0.75, 0.25]`
};

const mermaidTemplateOverlay = document.getElementById('mermaidTemplateOverlay');
const mermaidTemplateClose = document.getElementById('mermaidTemplateClose');
const mermaidTemplateCancelBtn = document.getElementById('mermaidTemplateCancelBtn');
const mermaidTemplateInsertBtn = document.getElementById('mermaidTemplateInsertBtn');
const mermaidTemplateCode = document.getElementById('mermaidTemplateCode');
const mermaidTemplatePreviewEl = document.getElementById('mermaidTemplatePreview');

let mermaidPreviewCounter = 0;
let mermaidPreviewDebounce = null;

async function updateMermaidPreview() {
  if (!mermaidTemplatePreviewEl) return;
  const code = mermaidTemplateCode ? mermaidTemplateCode.value.trim() : '';
  if (!code) {
    mermaidTemplatePreviewEl.innerHTML = '<span class="mermaid-preview-placeholder">Select a template to preview</span>';
    return;
  }
  try {
    const id = 'mermaid-tpl-prev-' + (++mermaidPreviewCounter);
    const { svg } = await mermaid.render(id, code);
    mermaidTemplatePreviewEl.innerHTML = svg;
  } catch {
    mermaidTemplatePreviewEl.innerHTML = '<span class="mermaid-preview-error">Invalid diagram syntax</span>';
  }
}

function scheduleMermaidPreview() {
  clearTimeout(mermaidPreviewDebounce);
  mermaidPreviewDebounce = setTimeout(updateMermaidPreview, 400);
}

function openMermaidTemplateDialog(code = null, mode = 'insert') {
  if (!mermaidTemplateOverlay) return;
  mermaidDialogMode = mode;

  if (code !== null) {
    mermaidTemplateCode.value = code;
  } else {
    mermaidTemplateCode.value = MERMAID_TEMPLATES.flowchart;
  }

  if (mermaidTemplateInsertBtn) {
    mermaidTemplateInsertBtn.textContent = mode === 'edit' ? 'Update (Ctrl+Enter)' : 'Insert (Ctrl+Enter)';
  }

  // Highlight flowchart button only for fresh inserts; clear for edit mode or pre-filled code
  mermaidTemplateOverlay.querySelectorAll('.mermaid-tpl-btn').forEach(btn => {
    btn.classList.toggle('active', mode === 'insert' && code === null && btn.dataset.tpl === 'flowchart');
  });

  mermaidTemplateOverlay.classList.add('visible');
  mermaidTemplateCode.focus();
  updateMermaidPreview();
}

function closeMermaidTemplateDialog() {
  mermaidTemplateOverlay && mermaidTemplateOverlay.classList.remove('visible');
}

async function insertMermaidFromDialog() {
  const code = mermaidTemplateCode.value.trim();
  if (!code) return;
  closeMermaidTemplateDialog();

  // Capture and reset state immediately so re-entrant calls are safe
  const mode = mermaidDialogMode;
  const editTarget = editingMermaidContainer;
  mermaidDialogMode = 'insert';
  editingMermaidContainer = null;

  if (mode === 'edit') {
    if (!editTarget) return;

    const mermaidEl = editTarget.querySelector('.mermaid');
    const oldCode = mermaidEl?.dataset?.mermaidSrc?.trim() || '';
    const content = isEditMode ? markdownEditor.value : originalMarkdown;

    // Replace the matching mermaid block in source (normalize line endings for robust matching)
    let newContent = content;
    if (oldCode) {
      const normalOld = normalizeMermaidCode(oldCode);
      const mermaidBlockRegex = /```mermaid[^\S\r\n]*[\r\n]+([\s\S]*?)```/g;
      let m;
      while ((m = mermaidBlockRegex.exec(content)) !== null) {
        if (normalizeMermaidCode(m[1]) === normalOld) {
          newContent = content.substring(0, m.index) + '```mermaid\n' + code + '\n```' + content.substring(m.index + m[0].length);
          break;
        }
      }
    }

    historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

    if (isEditMode) {
      markdownEditor.value = newContent;
      hasUnsavedChanges = true;
      updateUnsavedIndicator();
    } else {
      originalMarkdown = newContent;
      invalidateTranslationCache();
      hasUnsavedChanges = true;
    }
    syncEditorWithStore();

    await renderMermaidInDOM(code, 'replace', editTarget);
    showNotification('Mermaid updated', 1500);

  } else {
    // INSERT mode
    const mermaidBlock = '\n```mermaid\n' + code + '\n```\n';
    historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

    if (isEditMode) {
      const cursorPos = savedCursorPosition !== null ? savedCursorPosition : markdownEditor.selectionStart;
      const safePos = skipPastCodeBlock(markdownEditor.value, cursorPos);
      const before = markdownEditor.value.substring(0, safePos);
      const after = markdownEditor.value.substring(safePos);
      markdownEditor.value = before + mermaidBlock + after;
      const newCursor = safePos + mermaidBlock.length;
      markdownEditor.selectionStart = markdownEditor.selectionEnd = newCursor;
      markdownEditor.focus();
      hasUnsavedChanges = true;
      updateUnsavedIndicator();
      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => renderMarkdown(markdownEditor.value), TIMING.previewDebounceDelay);
      showNotification('Mermaid inserted', 1000);
    } else {
      // View mode: DOM patch, no full re-render
      const activeContent = getActiveMarkdown();
      const insertPos = skipPastCodeBlock(activeContent, getBlockInsertPosition());
      const before = activeContent.substring(0, insertPos);
      const after = activeContent.substring(insertPos);
      const newContent = before + mermaidBlock + after;

      originalMarkdown = newContent;
      invalidateTranslationCache();
      hasUnsavedChanges = true;
      syncEditorWithStore();

      await renderMermaidInDOM(code, 'insert');
      showNotification('Mermaid inserted', 1000);
    }
  }
}

mermaidTemplateOverlay && mermaidTemplateOverlay.querySelectorAll('.mermaid-tpl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tpl = MERMAID_TEMPLATES[btn.dataset.tpl];
    if (tpl) mermaidTemplateCode.value = tpl;
    mermaidTemplateOverlay.querySelectorAll('.mermaid-tpl-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateMermaidPreview();
  });
});

mermaidTemplateCode && mermaidTemplateCode.addEventListener('input', scheduleMermaidPreview);

mermaidTemplateClose && mermaidTemplateClose.addEventListener('click', closeMermaidTemplateDialog);
mermaidTemplateCancelBtn && mermaidTemplateCancelBtn.addEventListener('click', closeMermaidTemplateDialog);
mermaidTemplateInsertBtn && mermaidTemplateInsertBtn.addEventListener('click', insertMermaidFromDialog);

// Ctrl+Enter in dialog → insert
mermaidTemplateCode && mermaidTemplateCode.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    insertMermaidFromDialog();
  }
});

// ============================================
// TABLE INSERT DIALOG
// ============================================

const tableInsertOverlay = document.getElementById('tableInsertOverlay');
const tableInsertClose = document.getElementById('tableInsertClose');
const tableInsertCancelBtn = document.getElementById('tableInsertCancelBtn');
const tableInsertBtn = document.getElementById('tableInsertBtn');
const tableInsertRowsEl = document.getElementById('tableInsertRows');
const tableInsertColsEl = document.getElementById('tableInsertCols');
const tableInsertHeaderEl = document.getElementById('tableInsertHeader');
const tableInsertPreviewEl = document.getElementById('tableInsertPreview');
const tableInsertMarkdownEl = document.getElementById('tableInsertMarkdown');

function buildTableMarkdown(rows, cols, hasHeader) {
  const lines = [];
  // Header row
  const headerCells = Array.from({ length: cols }, (_, i) => ` Header ${i + 1} `);
  lines.push('|' + headerCells.join('|') + '|');
  // Separator
  const sep = Array.from({ length: cols }, () => ' --- ');
  lines.push('|' + sep.join('|') + '|');
  // Data rows
  const dataRowCount = hasHeader ? rows - 1 : rows;
  for (let r = 0; r < Math.max(1, dataRowCount); r++) {
    const cells = Array.from({ length: cols }, (_, c) => ` Cell ${r + 1},${c + 1} `);
    lines.push('|' + cells.join('|') + '|');
  }
  return lines.join('\n');
}

function updateTablePreview() {
  if (!tableInsertRowsEl || !tableInsertColsEl) return;
  const rows = Math.max(1, Math.min(30, parseInt(tableInsertRowsEl.value) || 3));
  const cols = Math.max(1, Math.min(15, parseInt(tableInsertColsEl.value) || 3));
  const hasHeader = tableInsertHeaderEl ? tableInsertHeaderEl.checked : true;
  const md = buildTableMarkdown(rows, cols, hasHeader);
  if (tableInsertMarkdownEl) tableInsertMarkdownEl.value = md;
  // HTML preview
  if (tableInsertPreviewEl) {
    tableInsertPreviewEl.innerHTML = DOMPurify.sanitize(marked.parse(md));
  }
}

function openTableInsertDialog(md = null, mode = 'insert') {
  if (!tableInsertOverlay) return;
  tableDialogMode = mode;

  if (md !== null && mode === 'edit') {
    // Pre-fill the markdown textarea and render preview directly
    if (tableInsertMarkdownEl) tableInsertMarkdownEl.value = md.trim();
    if (tableInsertPreviewEl) {
      tableInsertPreviewEl.innerHTML = DOMPurify.sanitize(marked.parse(md.trim()));
    }
  } else {
    updateTablePreview();
  }

  if (tableInsertBtn) {
    tableInsertBtn.textContent = mode === 'edit' ? 'Update' : 'Insert';
  }

  tableInsertOverlay.classList.add('visible');
}

function closeTableInsertDialog() {
  tableInsertOverlay && tableInsertOverlay.classList.remove('visible');
}

function getCleanTableMarkdown() {
  const raw = tableInsertMarkdownEl ? tableInsertMarkdownEl.value : '';
  return raw.split('\n').map(l => l.trim()).join('\n');
}

function insertTableFromDialog() {
  const md = getCleanTableMarkdown();
  if (!md) return;
  closeTableInsertDialog();

  // Capture and reset state immediately
  const mode = tableDialogMode;
  const editTarget = editingTableEl;
  tableDialogMode = 'insert';
  editingTableEl = null;

  if (mode === 'edit') {
    if (!editTarget) return;

    const content = isEditMode ? markdownEditor.value : originalMarkdown;
    const headers = [...editTarget.querySelectorAll('th')].map(th => th.textContent.trim());
    const cellTexts = [...editTarget.querySelectorAll('td')].map(td => td.textContent.trim());

    // Find the best-matching table block in source (same scoring as deleteTableFromSource)
    const tableRegex = /(\|[^\n]+\|[ \t]*\n)+\|[^\n]+\|[ \t]*(?:\n|$)/g;
    let m;
    let bestStart = -1;
    let bestEnd = -1;
    let bestScore = -1;

    while ((m = tableRegex.exec(content)) !== null) {
      const tableText = m[0];
      const firstLine = tableText.split('\n').filter(l => l.trim())[0] || '';
      let score = 0;
      for (const h of headers) { if (firstLine.includes(h)) score += 2; }
      for (const c of cellTexts.slice(0, 6)) { if (tableText.includes(c)) score++; }
      if (score > bestScore) { bestScore = score; bestStart = m.index; bestEnd = m.index + m[0].length; }
    }

    let newContent = content;
    if (bestStart !== -1) {
      newContent = content.substring(0, bestStart) + md + content.substring(bestEnd);
    }

    historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

    if (isEditMode) {
      markdownEditor.value = newContent;
      hasUnsavedChanges = true;
      updateUnsavedIndicator();
    } else {
      originalMarkdown = newContent;
      invalidateTranslationCache();
      hasUnsavedChanges = true;
    }
    syncEditorWithStore();

    renderTableInDOM(md, 'replace', editTarget);
    showNotification('Table updated', 1500);

  } else {
    // INSERT mode
    historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

    if (isEditMode) {
      const cursorPos = savedCursorPosition !== null ? savedCursorPosition : markdownEditor.selectionStart;
      const safePos = skipPastCodeBlock(markdownEditor.value, cursorPos);
      const before = markdownEditor.value.substring(0, safePos);
      const after = markdownEditor.value.substring(safePos);
      markdownEditor.value = before + '\n' + md + '\n' + after;
      const newCursor = safePos + md.length + 2;
      markdownEditor.selectionStart = markdownEditor.selectionEnd = newCursor;
      markdownEditor.focus();
      hasUnsavedChanges = true;
      updateUnsavedIndicator();
      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => renderMarkdown(markdownEditor.value), TIMING.previewDebounceDelay);
      showNotification('Table inserted', 1000);
    } else {
      // View mode: DOM patch, no full re-render
      const activeContent = getActiveMarkdown();
      const insertPos = skipPastCodeBlock(activeContent, getBlockInsertPosition());
      const before = activeContent.substring(0, insertPos);
      const after = activeContent.substring(insertPos);
      const newContent = before + '\n' + md + '\n' + after;

      originalMarkdown = newContent;
      invalidateTranslationCache();
      hasUnsavedChanges = true;
      syncEditorWithStore();

      renderTableInDOM(md, 'insert');
      showNotification('Table inserted', 1000);
    }
  }
}

tableInsertRowsEl && tableInsertRowsEl.addEventListener('input', updateTablePreview);
tableInsertColsEl && tableInsertColsEl.addEventListener('input', updateTablePreview);
tableInsertHeaderEl && tableInsertHeaderEl.addEventListener('change', updateTablePreview);
tableInsertMarkdownEl && tableInsertMarkdownEl.addEventListener('input', () => {
  if (tableInsertPreviewEl) {
    const md = getCleanTableMarkdown();
    tableInsertPreviewEl.innerHTML = DOMPurify.sanitize(marked.parse(md));
  }
});
tableInsertClose && tableInsertClose.addEventListener('click', closeTableInsertDialog);
tableInsertCancelBtn && tableInsertCancelBtn.addEventListener('click', closeTableInsertDialog);
tableInsertBtn && tableInsertBtn.addEventListener('click', insertTableFromDialog);

// Close dialogs on overlay click
mermaidTemplateOverlay && mermaidTemplateOverlay.addEventListener('click', (e) => {
  if (e.target === mermaidTemplateOverlay) closeMermaidTemplateDialog();
});
tableInsertOverlay && tableInsertOverlay.addEventListener('click', (e) => {
  if (e.target === tableInsertOverlay) closeTableInsertDialog();
});

// ============================================
// UNIVERSAL CONTENT INSERTION AT CURSOR
// ============================================

// Insert content at cursor position (works in both edit mode and view mode)
function insertContentAtCursor(content) {
  historyPush(isEditMode ? markdownEditor.value : originalMarkdown);

  if (isEditMode) {
    const cursorPos = savedCursorPosition !== null ? savedCursorPosition : markdownEditor.selectionStart;
    const safePos = skipPastCodeBlock(markdownEditor.value, cursorPos);
    const before = markdownEditor.value.substring(0, safePos);
    const after = markdownEditor.value.substring(safePos);
    const newContent = before + content + after;
    markdownEditor.value = newContent;
    const newCursor = safePos + content.length;
    markdownEditor.selectionStart = markdownEditor.selectionEnd = newCursor;
    markdownEditor.focus();
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => renderMarkdown(markdownEditor.value), TIMING.previewDebounceDelay);
  } else {
    // View mode: insert at position determined by right-click location in markdown
    const scrollPosition = contentWrapper.scrollTop;
    const activeContent = getActiveMarkdown();
    const insertPos = skipPastCodeBlock(activeContent, getBlockInsertPosition());
    const before = activeContent.substring(0, insertPos);
    const after = activeContent.substring(insertPos);
    const newContent = before + content + after;
    commitViewModeEdit(newContent, scrollPosition, () => {
      const origPos = Math.min(insertPos, originalMarkdown.length);
      const origBefore = originalMarkdown.substring(0, origPos);
      const origAfter = originalMarkdown.substring(origPos);
      originalMarkdown = origBefore + content + origAfter;
    });
  }
  showNotification('Inserted', 1000);
}

// ============================================
// NOTE DOM PATCHING
// ============================================

// Update a note in the DOM without full re-render (preserves mermaid, prism, scroll)
function patchNoteInDOM(noteId, updates) {
  const elements = viewer.querySelectorAll(`[data-note-id="${noteId}"]`);
  if (!elements.length) {
    // Fall back to full re-render
    renderMarkdown(originalMarkdown, 'full');
    return;
  }

  elements.forEach(el => {
    if (updates.title !== undefined) {
      const esc = updates.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      el.setAttribute('data-note-title', esc);
    }
    if (updates.content !== undefined) {
      const esc = updates.content.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      el.setAttribute('data-note-content', esc);
    }
    if (updates.color !== undefined) {
      el.setAttribute('data-note-color', updates.color);
    }
    if (updates.style !== undefined) {
      el.setAttribute('style', updates.style);
    }
    if (updates.labelText !== undefined && el.classList.contains('note-label')) {
      // Update visible label text while keeping all attributes intact
      el.textContent = updates.labelText;
    }
    if (updates.deleted) {
      // Unwrap: replace span with its children
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    }
  });

  // Re-apply note styles in DOM without full render
  applyNoteStyles();
  updateNotesList();
}

// ============================================
// POPUP EXPORT HANDLER (BroadcastChannel)
// ============================================

try {
  const exportChannel = new BroadcastChannel('omnicore-export');
  exportChannel.onmessage = (event) => {
    if (!event.data) return;
    if (event.data.type === 'request-pdf-export') {
      const currentFileName = currentFilePath ? path.basename(currentFilePath) : null;
      const channel = corporateMode ? 'export-pdf-corporate' : 'export-pdf';
      ipcRenderer.send(channel, { currentFileName });
      ipcRenderer.once('pdf-export-result', (_ev, result) => {
        exportChannel.postMessage({ type: 'export-result', ...result });
      });
    }
  };
} catch (e) {
  console.warn('BroadcastChannel not available:', e.message);
}

// ============================================
// Recent Files Context Menu
// ============================================

const recentContextMenu = document.getElementById('recentContextMenu');
const ctxOpenFolder = document.getElementById('ctxOpenFolder');
const ctxRemoveRecent = document.getElementById('ctxRemoveRecent');
const ctxCopyPath = document.getElementById('ctxCopyPath');

let recentContextFilePath = null;

function showRecentContextMenu(x, y, filePath) {
  recentContextFilePath = filePath;

  // Use helper for positioning (handles screen edge adjustment)
  positionContextMenu(recentContextMenu, x, y);
}

function hideRecentContextMenu() {
  recentContextMenu.classList.remove('visible');
  recentContextFilePath = null;
}

// Hide recent context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!recentContextMenu.contains(e.target)) {
    hideRecentContextMenu();
  }
});

// Hide on scroll or resize
document.addEventListener('scroll', hideRecentContextMenu, true);
window.addEventListener('resize', hideRecentContextMenu);

// Hide on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideRecentContextMenu();
  }
});

// Open containing folder
ctxOpenFolder.addEventListener('click', () => {
  if (recentContextFilePath) {
    ipcRenderer.send('open-folder-in-explorer', recentContextFilePath);
  }
  hideRecentContextMenu();
});

// Remove from recent files
ctxRemoveRecent.addEventListener('click', () => {
  if (recentContextFilePath) {
    let recentFiles = getRecentFiles();
    recentFiles = recentFiles.filter(f => f.path !== recentContextFilePath);
    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
    updateFileMenuRecent();
  }
  hideRecentContextMenu();
});

// Copy file path
ctxCopyPath.addEventListener('click', () => {
  if (recentContextFilePath) {
    clipboard.writeText(recentContextFilePath);
    showNotification(i18n('notif.pathCopied'), 1500);
  }
  hideRecentContextMenu();
});

// ============================================
// Notes Panel Context Menu
// ============================================

const notesPanelContextMenu = document.getElementById('notesPanelContextMenu');
const ctxNotesPanelEdit = document.getElementById('ctxNotesPanelEdit');
const ctxNotesPanelDelete = document.getElementById('ctxNotesPanelDelete');

let notesPanelContextNoteId = null;

function showNotesPanelContextMenu(x, y, noteId) {
  notesPanelContextNoteId = noteId;
  positionContextMenu(notesPanelContextMenu, x, y);
}

function hideNotesPanelContextMenu() {
  notesPanelContextMenu.classList.remove('visible');
  notesPanelContextNoteId = null;
}

document.addEventListener('click', (e) => {
  if (!notesPanelContextMenu.contains(e.target)) {
    hideNotesPanelContextMenu();
  }
});

document.addEventListener('scroll', hideNotesPanelContextMenu, true);
window.addEventListener('resize', hideNotesPanelContextMenu);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideNotesPanelContextMenu();
});

// Edit note from notes panel
ctxNotesPanelEdit.addEventListener('click', () => {
  const nid = notesPanelContextNoteId;
  hideNotesPanelContextMenu();
  if (!nid || !currentFilePath) return;
  const noteEl = viewer.querySelector(`[data-note-id="${nid}"]`);
  if (!noteEl) return;
  openNoteDialogForEdit(noteEl);
});

// Delete note from notes panel
ctxNotesPanelDelete.addEventListener('click', () => {
  const nid = notesPanelContextNoteId;
  hideNotesPanelContextMenu();
  if (!nid || !currentFilePath) return;
  const noteEl = viewer.querySelector(`[data-note-id="${nid}"]`);
  if (!noteEl) return;

  const isLabel = noteEl.classList.contains('note-label');

  if (isEditMode) {
    const editorVal = markdownEditor.value;
    const match = findNoteSpanInSource(editorVal, noteEl);
    if (match) {
      const replacement = isLabel ? '' : match[1];
      markdownEditor.value =
        editorVal.substring(0, match.index) +
        replacement +
        editorVal.substring(match.index + match[0].length);

      hasUnsavedChanges = true;
      updateUnsavedIndicator();

      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        renderMarkdown(markdownEditor.value);
      }, 300);

      showNotification(i18n('notif.noteRemoved'), 1500);
    } else {
      showNotification(i18n('notif.noteNotFound'), 2000);
    }
  } else {
    const activeSource = getActiveMarkdown();
    const match = findNoteSpanInSource(activeSource, noteEl);
    if (match) {
      const replacement = isLabel ? '' : match[1];
      const scrollPosition = contentWrapper.scrollTop;
      const newContent =
        activeSource.substring(0, match.index) +
        replacement +
        activeSource.substring(match.index + match[0].length);

      commitViewModeEdit(newContent, scrollPosition, () => {
        const nid = noteEl.getAttribute('data-note-id');
        const origMatch = nid ? findNoteSpanById(originalMarkdown, nid) : findNoteSpanInSource(originalMarkdown, noteEl);
        if (origMatch) {
          const origReplacement = isLabel ? '' : origMatch[1];
          originalMarkdown = originalMarkdown.substring(0, origMatch.index) + origReplacement + originalMarkdown.substring(origMatch.index + origMatch[0].length);
        }
      });

      showNotification(i18n('notif.noteRemoved'), 1500);
    } else {
      showNotification(i18n('notif.noteNotFound'), 2000);
    }
  }

  // Refresh the notes list
  updateNotesList();
});

// ============================================
// WELCOME SCREEN SLIDER
// ============================================

(function initWelcomeSlider() {
  const track = document.getElementById('welcomeSlidesTrack');
  const dotsContainer = document.getElementById('welcomeDots');
  if (!track || !dotsContainer) return;

  const slides = track.querySelectorAll('.welcome-slide');
  const dots = dotsContainer.querySelectorAll('.welcome-dot');
  let current = 0;
  let timer = null;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 5000);
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); resetTimer(); });
  });

  resetTimer();
})();

// Set welcome version from app
(async function setWelcomeVersion() {
  try {
    const version = await ipcRenderer.invoke('get-version');
    const el = document.getElementById('welcomeVersion');
    if (el && version) el.textContent = 'v' + version;
  } catch (e) {}
})();
