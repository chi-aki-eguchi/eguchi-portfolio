/* Local preview controls. No analytics, storage, API writes or form submission. */
const tabs = [...document.querySelectorAll('[data-tour-tab]')];
function selectTab(tab, focus = false) {
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    document.getElementById(candidate.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
  });
}
const tabList = document.querySelector('[role=tablist]');
const mobile = matchMedia('(max-width:720px)');
function syncTabOrientation() { tabList.setAttribute('aria-orientation', mobile.matches ? 'horizontal' : 'vertical'); }
mobile.addEventListener('change', syncTabOrientation); syncTabOrientation();

const dialog = document.getElementById('consult-dialog');
const form = document.getElementById('consult-form');
const note = document.getElementById('consult-note');
const status = document.getElementById('memo-status');
let opener;
function updateNote() {
  const fields = new FormData(form);
  note.value = ['Portfolio Kit ご相談前のメモ', '', '気になるプラン: ' + fields.get('plan'), '使いたい場面: ' + fields.get('purpose'), '希望時期: ' + fields.get('timing'), '素材の準備: ' + fields.get('materials'), '', '確認したいこと: 制作範囲・総額・サーバー/ドメインの実費・納期・公開後の窓口', '', 'このメモは未送信です。注文・契約・納期の確約ではありません。'].join('\n');
  status.textContent = '';
}
for (const button of document.querySelectorAll('[data-open-consult]')) {
  button.addEventListener('click', () => {
    opener = button;
    const plan = button.dataset.plan;
    const select = form.elements.namedItem('plan');
    if (plan) {
      const option = [...select.options].find(item => item.dataset.plan === plan);
      if (option) select.value = option.value;
    }
    updateNote(); dialog.showModal(); document.body.classList.add('dialog-open');
  });
}
document.querySelector('[data-close-consult]').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); opener?.focus(); });
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
form.addEventListener('change', updateNote);
form.addEventListener('submit', event => event.preventDefault());
document.getElementById('copy-note').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(note.value); status.textContent = 'メモをコピーしました。送信はしていません。'; }
  catch { note.focus(); note.select(); status.textContent = 'コピーできなかったためメモを選択しました。手動コピーかテキスト保存をご利用ください。'; }
});
document.getElementById('download-note').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([note.value + '\n'], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'portfolio-kit-consultation-note.txt'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = '保存用のメモを作成しました。送信はしていません。';
});
// Reveal a disclosure linked by its fragment, including direct URL visits.
function revealDisclosure() {
  const target = document.getElementById(location.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
}
addEventListener('hashchange', revealDisclosure); revealDisclosure();
updateNote();
