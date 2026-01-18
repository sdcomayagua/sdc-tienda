/* assets/css/checkout.css */

/* --- Animación badge carrito --- */
@keyframes badgePulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.25); }
  70%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}
.badge.pulse{
  animation: badgePulse 420ms ease-out;
}

/* --- Modal producto actions --- */
.prodActions{
  display:flex;
  gap:10px;
  margin-top:12px;
}
@media (max-width: 720px){
  .prodActions{ flex-direction:column; }
}

/* --- Tabs carrito --- */
.tabsRow{
  display:flex;
  gap:10px;
  margin-bottom:12px;
}
.tabBtn{
  flex:1;
  border:1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text);
  padding:10px 12px;
  border-radius:14px;
  font-weight:1000;
}
.tabBtn.active{
  background: rgba(11,87,255,.18);
  border-color: rgba(11,87,255,.40);
}

/* --- forms --- */
.formGrid{
  display:grid;
  gap:10px;
}

/* --- carrito list --- */
.cartList{
  display:flex;
  flex-direction:column;
  gap:10px;
  margin-top:12px;
}
.cartItem{
  display:flex;
  gap:10px;
  align-items:center;
  border:1px solid var(--border);
  border-radius:16px;
  padding:10px;
  background: var(--card2);
}
.cartItem img{
  width:62px;
  height:62px;
  border-radius:14px;
  object-fit:cover;
  flex:0 0 auto;
  background: var(--card);
}
.cartMeta{ flex:1; min-width:0; }
.cartMeta .n{
  font-weight:1000;
  font-size:13px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cartMeta .p{
  color:var(--muted);
  font-size:12px;
  margin-top:4px;
}
.qty{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:8px;
}
.qty button{
  width:34px;
  height:34px;
  border-radius:12px;
  border:1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-weight:1000;
  display:grid;
  place-items:center;
}
.qty .trash{
  width:36px;
  height:36px;
  border-radius:12px;
  border:1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--muted);
}

/* --- pay chips --- */
.payChips{
  display:flex;
  gap:10px;
  overflow:auto;
  padding:6px 2px 2px;
  scrollbar-width:none;
}
.payChips::-webkit-scrollbar{display:none}
.payChip{
  border:1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text);
  padding:10px 12px;
  border-radius:999px;
  font-weight:1000;
  display:flex;
  align-items:center;
  gap:8px;
  white-space:nowrap;
}
.payChip.active{
  background: rgba(11,87,255,.18);
  border-color: rgba(11,87,255,.40);
}

/* --- móvil --- */
@media (max-width: 720px){
  .modal{ inset:auto 8px 8px 8px; border-radius:20px; }
  .modalHeader{ padding:12px; }
  .modalBody{ padding:12px; }
  .modalFooter{ padding:12px; }
}