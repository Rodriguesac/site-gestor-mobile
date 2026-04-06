import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase'; 
import { 
  collection, onSnapshot, doc, updateDoc, 
  deleteDoc, addDoc, query 
} from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SISTEMA DE ARRASTE (DND-KIT) ---
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  rectSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- SUB-COMPONENTE: CARD PREMIUM COM SUPORTE A ARRASTE ---
function SortableItem({ item, alternarDisponibilidade, setEditandoItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    touchAction: 'none', 
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group relative h-56 rounded-[2.5rem] overflow-hidden border-2 transition-all duration-300 ${
        isDragging 
          ? 'border-[#82C91E] scale-105 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] z-50' 
          : 'border-white/10 hover:border-[#82C91E]/40 shadow-lg'
      } bg-white`}
    >
      <img 
        src={item.imagem_url || 'https://via.placeholder.com/400?text=Sem+Imagem'} 
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${!item.disponivel ? 'grayscale brightness-50' : ''}`}
        alt={item.nome}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#4B0082]/90 via-[#4B0082]/20 to-transparent" />

      <div 
        {...attributes} {...listeners}
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <Lucide.GripVertical className="text-white/0 group-hover:text-white/30 transition-all" size={32} />
      </div>

      {!item.disponivel && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-[1000] uppercase px-4 py-1.5 rounded-full z-20 shadow-lg italic">
          Item Pausado
        </div>
      )}

      <div className="absolute inset-0 p-5 flex flex-col justify-between z-20 pointer-events-none">
        <div className="flex justify-between items-start">
          <button 
            onClick={(e) => { e.preventDefault(); alternarDisponibilidade(item); }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-md border pointer-events-auto transition-all active:scale-90 ${
                item.disponivel 
                ? 'bg-white/20 border-white/20 text-[#82C91E]' 
                : 'bg-red-500/80 border-red-400 text-white'
            }`}
          >
            {item.disponivel ? <Lucide.Eye size={18} /> : <Lucide.EyeOff size={18} />}
          </button>
          
          <button 
            onClick={(e) => { e.preventDefault(); setEditandoItem(item); }}
            className="w-10 h-10 bg-white/90 hover:bg-[#82C91E] text-[#4B0082] rounded-2xl flex items-center justify-center border border-white pointer-events-auto transition-all active:scale-90 shadow-lg"
          >
            <Lucide.Pencil size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="text-center">
          <p className="text-white font-[1000] uppercase italic text-[12px] leading-tight drop-shadow-md">
            {item.nome}
          </p>
          <div className="mt-2 inline-block px-3 py-1 bg-[#82C91E] rounded-xl shadow-lg">
             <p className="text-[#4B0082] font-[1000] text-[10px] italic">
                {item.preco ? `R$ ${Number(item.preco).toFixed(2).replace('.', ',')}` : (item.limite ? `${item.limite} GRÁTIS` : 'CONFIGURADO')}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Cardapio() {
  const [abaAtiva, setAbaAtiva] = useState('Monte Seu Açaí'); 
  const [subAbaMonte, setSubAbaMonte] = useState('cardapio_acai'); 
  const [itensCardapio, setItensCardapio] = useState([]);
  const [bases, setBases] = useState([]);
  const [editandoItem, setEditandoItem] = useState(null);
  const [novoItem, setNovoItem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [categoriasExtra, setCategoriasExtra] = useState([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categorias_extra"), (snap) => {
      setCategoriasExtra(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubCats();
  }, []);

  const getColecao = () => {
    if (abaAtiva === 'Monte Seu Açaí') return subAbaMonte;
    const catDinamica = categoriasExtra.find(c => c.nome === abaAtiva);
    return catDinamica ? catDinamica.colecao : 'outros';
  };

  const colecaoAtual = getColecao();

  useEffect(() => {
    if (!colecaoAtual) return;
    const unsub = onSnapshot(collection(db, colecaoAtual), (snap) => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        nome: d.data().nome || d.data().n || d.id,
        disponivel: d.data().disponivel ?? true,
        ordem: d.data().ordem ?? 999,
        ...d.data()
      }));
      setItensCardapio(docs.sort((a, b) => a.ordem - b.ordem));
    });
    return () => unsub();
  }, [colecaoAtual]);

  useEffect(() => {
    const unsubBases = onSnapshot(collection(db, "bases"), (snap) => {
      setBases(snap.docs.map(d => ({ id: d.id, nome: d.data().nome || d.id, ...d.data() })));
    });
    return () => unsubBases();
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = itensCardapio.findIndex((i) => i.id === active.id);
      const newIndex = itensCardapio.findIndex((i) => i.id === over.id);
      const novoArray = arrayMove(itensCardapio, oldIndex, newIndex);
      setItensCardapio(novoArray);
      for (let i = 0; i < novoArray.length; i++) {
        await updateDoc(doc(db, colecaoAtual, novoArray[i].id), { ordem: i });
      }
    }
  };

  const alternarDisponibilidade = async (item) => {
    await updateDoc(doc(db, colecaoAtual, item.id), { disponivel: !item.disponivel });
  };

  const salvarItem = async (e) => {
    e.preventDefault();
    const itemData = editandoItem || novoItem;
    const { id, ...dados } = itemData;
    if (colecaoAtual === 'adicionais') dados.n = dados.nome;
    
    try {
      if (itemData.id) {
        await updateDoc(doc(db, colecaoAtual, itemData.id), dados);
      } else {
        await addDoc(collection(db, colecaoAtual), { ...dados, ordem: itensCardapio.length });
      }
      setEditandoItem(null); setNovoItem(null);
    } catch (err) { alert("Erro ao salvar!"); }
  };

  const criarCategoria = async (isMonteAcai) => {
    const nome = prompt(`Nome da nova aba:`);
    if (!nome) return;
    const colecao = prompt("Nome técnico da coleção (sem espaços):");
    if (!colecao) return;
    await addDoc(collection(db, "categorias_extra"), { nome, colecao, isMonteAcai });
  };

  const subAbasPadrao = [
    {id: 'cardapio_acai', label: 'Tamanhos'}, 
    {id: 'bases', label: 'Bases'}, 
    {id: 'acompanhamentos_gratis', label: 'Grátis'}, 
    {id: 'adicionais', label: 'Adicionais'}, 
    {id: 'coberturas', label: 'Caldas'}
  ];
  const subAbasDinamicas = categoriasExtra.filter(c => c.isMonteAcai).map(c => ({ id: c.colecao, label: c.nome, idCat: c.id }));
  const todasSubAbas = [...subAbasPadrao, ...subAbasDinamicas];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col p-8 md:p-12 overflow-x-hidden">
      
      <div className="flex flex-col gap-8 mb-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[#4B0082] rounded-[1.8rem] flex items-center justify-center text-[#82C91E] shadow-2xl">
              <Lucide.LayoutGrid size={32} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-4xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">Gestão do Cardápio</h1>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Personalize a experiência do cliente em tempo real</p>
            </div>
          </div>
          
          <button onClick={() => setNovoItem({ nome: '', imagem_url: '', url_logo_item: '', disponivel: true })} className="bg-[#4B0082] hover:bg-[#3a0066] text-[#82C91E] px-8 py-5 rounded-[2rem] font-[1000] uppercase italic text-sm tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95">
             <Lucide.PlusCircle size={22} /> Novo Item
          </button>
        </div>

        <div className="bg-white p-3 rounded-[3rem] shadow-xl border border-slate-100 flex flex-wrap gap-2 items-center">
            <button onClick={() => setAbaAtiva('Monte Seu Açaí')} className={`px-8 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-[11px] tracking-widest transition-all ${abaAtiva === 'Monte Seu Açaí' ? 'bg-[#4B0082] text-[#82C91E] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                Monte Seu Açaí
            </button>
            {categoriasExtra.filter(c => !c.isMonteAcai).map(cat => (
                <div key={cat.id} className="flex items-center gap-1 group">
                    <button onClick={() => setAbaAtiva(cat.nome)} className={`px-8 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-[11px] tracking-widest transition-all ${abaAtiva === cat.nome ? 'bg-[#4B0082] text-[#82C91E] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                        {cat.nome}
                    </button>
                    <button onClick={async () => { if(confirm("Excluir aba?")) await deleteDoc(doc(db,"categorias_extra",cat.id)) }} className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center transition-all"><Lucide.X size={14}/></button>
                </div>
            ))}
            <button onClick={() => criarCategoria(false)} className="ml-auto px-6 py-4 rounded-[2.2rem] border-2 border-dashed border-slate-200 text-slate-400 font-black text-[10px] uppercase hover:border-[#82C91E] hover:text-[#82C91E] transition-all flex items-center gap-2">
                <Lucide.FolderPlus size={16}/> Nova Aba
            </button>
        </div>

        {abaAtiva === 'Monte Seu Açaí' && (
           <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 p-2 bg-slate-100/50 rounded-[2.5rem] border border-slate-200 shadow-inner">
               {todasSubAbas.map(sub => (
                   <button key={sub.id} onClick={() => setSubAbaMonte(sub.id)} className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${subAbaMonte === sub.id ? 'bg-white text-[#4B0082] shadow-md' : 'text-slate-500 hover:text-[#4B0082]'}`}>
                       {sub.label}
                   </button>
               ))}
               <button onClick={() => criarCategoria(true)} className="px-5 py-3 rounded-2xl text-[#82C91E] font-black uppercase text-[9px] border border-[#82C91E]/30 hover:bg-[#82C91E]/10 flex items-center gap-1">
                   <Lucide.Plus size={12}/> Etapa
               </button>
           </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-visible">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itensCardapio.map(i => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6 pb-40">
                {itensCardapio.map(item => (
                  <SortableItem key={item.id} item={item} alternarDisponibilidade={alternarDisponibilidade} setEditandoItem={setEditandoItem} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
      </div>

      <AnimatePresence>
          {(editandoItem || novoItem) && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#4B0082]/60 backdrop-blur-md p-6">
              <motion.form initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onSubmit={salvarItem} className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden border-b-[20px] border-[#82C91E]">
                <div className="p-10 flex flex-col md:flex-row gap-12">
                  
                  <div className="w-full md:w-[350px] space-y-6">
                    <div className="h-[400px] bg-slate-100 rounded-[3rem] overflow-hidden border-4 border-slate-50 shadow-inner relative group">
                        <img src={(editandoItem?.imagem_url || novoItem?.imagem_url) || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" alt="Preview"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Lucide.Camera size={40} className="text-white"/>
                        </div>
                    </div>
                    <input placeholder="URL da Imagem..." value={editandoItem?.imagem_url || novoItem?.imagem_url || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, imagem_url: e.target.value}) : setNovoItem({...novoItem, imagem_url: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-[11px] font-bold text-slate-500 outline-none focus:border-[#4B0082]" />
                  </div>

                  <div className="flex-1 space-y-8 flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                        <h3 className="text-3xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">{editandoItem ? 'Editar Registro' : 'Novo Registro'}</h3>
                        <button type="button" onClick={() => {setEditandoItem(null); setNovoItem(null)}} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"><Lucide.X size={24}/></button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">Nome de Exibição</label>
                          <input required value={editandoItem?.nome || novoItem?.nome || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, nome: e.target.value}) : setNovoItem({...novoItem, nome: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-lg font-black text-[#4B0082] outline-none focus:border-[#82C91E]" />
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">Logo da Marca (Opcional)</label>
                          <input value={editandoItem?.url_logo_item || novoItem?.url_logo_item || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, url_logo_item: e.target.value}) : setNovoItem({...novoItem, url_logo_item: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-xs font-bold text-[#82C91E] outline-none" placeholder="URL da logo em PNG..." />
                        </div>

                        {colecaoAtual === 'cardapio_acai' ? (
                          <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 space-y-8">
                             <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1 block">Limite Grátis</label>
                                    <input type="number" value={editandoItem?.limite || novoItem?.limite || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, limite: e.target.value}) : setNovoItem({...novoItem, limite: e.target.value})} className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 text-center font-black text-[#4B0082]" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1 block">Limite Caldas</label>
                                    <input type="number" value={editandoItem?.limite_coberturas || novoItem?.limite_coberturas || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, limite_coberturas: e.target.value}) : setNovoItem({...novoItem, limite_coberturas: e.target.value})} className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 text-center font-black text-[#4B0082]" />
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                {bases.map(base => (
                                  <div key={base.id} className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                                    <label className="text-[9px] font-black uppercase text-[#4B0082] block mb-1">{base.nome}</label>
                                    <input type="number" step="0.01" value={editandoItem?.[base.cat || base.nome] || novoItem?.[base.cat || base.nome] || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, [base.cat || base.nome]: e.target.value}) : setNovoItem({...novoItem, [base.cat || base.nome]: e.target.value})} className="w-full bg-transparent text-[#82C91E] font-black text-center text-lg outline-none" placeholder="0,00" />
                                  </div>
                                ))}
                             </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">Preço Final (R$)</label>
                            <input type="number" step="0.01" value={editandoItem?.preco || novoItem?.preco || ''} onChange={e => editandoItem ? setEditandoItem({...editandoItem, preco: e.target.value}) : setNovoItem({...novoItem, preco: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-2xl font-black text-[#82C91E] outline-none" placeholder="0,00" />
                          </div>
                        )}
                    </div>

                    <div className="mt-auto flex gap-4">
                        <button type="submit" className="flex-1 py-6 bg-[#4B0082] text-[#82C91E] rounded-[2rem] font-[1000] uppercase italic tracking-widest shadow-2xl active:scale-95 transition-all">Salvar Alterações</button>
                        <button type="button" onClick={() => setConfirmarExclusao(editandoItem)} className="w-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Lucide.Trash2 size={24}/></button>
                    </div>
                  </div>
                </div>
              </motion.form>
            </div>
          )}
      </AnimatePresence>

      <style>{` ::-webkit-scrollbar { display: none; } body { background: #F8FAFC; } `}</style>
    </div>
  );
}