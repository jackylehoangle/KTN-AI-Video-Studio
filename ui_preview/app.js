const toast=document.getElementById('toast');
const showToast=(msg)=>{toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2400)};
document.querySelectorAll('.nav-item[data-section]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    if(btn.dataset.section!=='create') showToast('Mục “'+btn.textContent.trim()+'” sẽ được hoàn thiện khi chúng ta đi từng chức năng.');
  });
});
document.getElementById('generateBtn').addEventListener('click',()=>{
  const topic=document.getElementById('topic').value.trim();
  if(!topic){showToast('Anh nhập thử một chủ đề trước để xem trạng thái giao diện.');return;}
  document.getElementById('scriptEmpty').classList.add('hidden');
  document.getElementById('scriptDemo').classList.remove('hidden');
  showToast('Demo giao diện: kịch bản mẫu đã hiển thị. Backend AI chưa được nối trong bản Preview.');
});
document.querySelectorAll('.quick-row button,.ghost,.icon-btn,.secondary').forEach(btn=>btn.addEventListener('click',()=>showToast('Đây là bản Preview giao diện. Chức năng này sẽ được nối ở bước tiếp theo.')));
