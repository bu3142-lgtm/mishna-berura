(function(){
  // Номер для WhatsApp — только цифры, с кодом страны, без «+».
  var WA_NUMBER='9725475759292';
  var btn=document.getElementById('donateBtn');
  if(!btn)return;
  var dlg=document.createElement('dialog');
  dlg.id='donateDialog';
  dlg.className='donate-dialog';
  dlg.setAttribute('aria-labelledby','donateTitle');
  dlg.innerHTML=
    '<div class="dialog-top"><span class="eyebrow">ПОДДЕРЖКА ПРОЕКТА</span>'+
    '<button type="button" class="icon-button" data-donate-close aria-label="Закрыть">×</button></div>'+
    '<h2 id="donateTitle">Поддержать издание</h2>'+
    '<p class="dialog-intro">Если этот труд вам полезен, вы можете поддержать его и написать автору. '+
    'Напишите сообщение — оно откроется в WhatsApp, и вам останется нажать «Отправить».</p>'+
    '<label class="donate-label" for="donateName">Ваше имя (по желанию)</label>'+
    '<input id="donateName" class="donate-field" type="text" maxlength="60" autocomplete="name">'+
    '<label class="donate-label" for="donateText">Сообщение</label>'+
    '<textarea id="donateText" class="donate-field" rows="5" maxlength="1000" '+
    'placeholder="Например: хочу поддержать проект. Как это сделать?"></textarea>'+
    '<a id="donateSend" class="donate-send" target="_blank" rel="noopener noreferrer">Отправить в WhatsApp</a>';
  document.body.appendChild(dlg);

  var name=dlg.querySelector('#donateName'),
      text=dlg.querySelector('#donateText'),
      send=dlg.querySelector('#donateSend');

  function build(){
    var msg='Здравствуйте! Пишу с сайта «Мишна Брура — русское издание».';
    var t=text.value.trim(), n=name.value.trim();
    if(t)msg+='\n\n'+t;
    if(n)msg+='\n\n— '+n;
    send.href='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(msg);
  }
  name.addEventListener('input',build);
  text.addEventListener('input',build);
  build();

  btn.addEventListener('click',function(){
    build();
    if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  });
  dlg.querySelector('[data-donate-close]').addEventListener('click',function(){dlg.close()});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
  send.addEventListener('click',function(){setTimeout(function(){dlg.close()},300)});
})();
