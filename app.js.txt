// Service Workerの登録処理（PWA化に必須）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker 登録成功:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker 登録失敗:', error);
      });
  });
}

// 画面の動作処理
document.addEventListener('DOMContentLoaded', () => {
  const actionBtn = document.getElementById('actionBtn');
  const statusText = document.getElementById('statusText');

  if (actionBtn && statusText) {
    actionBtn.addEventListener('click', () => {
      statusText.textContent = 'ボタンがタップされました！動作確認OKです。';
    });
  }
});