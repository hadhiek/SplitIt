import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';

const money = (value) => `₹${(Number(value || 0)).toFixed(2)}`;
const toCents = (value) => Math.round((Number(value) || 0) * 100);

function allocateCents(totalCents, weightedPeople) {
  const people = weightedPeople.filter((person) => person.id);
  if (!people.length || totalCents === 0) return {};
  const weightSum = people.reduce((sum, person) => sum + Math.max(0, person.weight), 0);
  const useEqualWeights = weightSum === 0;
  const denominator = useEqualWeights ? people.length : weightSum;
  const portions = people.map((person) => {
    const weight = useEqualWeights ? 1 : Math.max(0, person.weight);
    const exact = totalCents * weight / denominator;
    return { id: person.id, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = totalCents - portions.reduce((sum, part) => sum + part.cents, 0);
  portions.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining; i += 1) portions[i % portions.length].cents += 1;
  return Object.fromEntries(portions.map((part) => [part.id, part.cents]));
}

function parseReceiptText(text) {
  const ignored = /^(sub\s?total|subtotal|total|tax|gst|cgst|sgst|vat|discount|change|cash|card|upi|balance|round\s?off|thank you|invoice|receipt|date|time|qty|quantity|price|amount)\b/i;
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || ignored.test(line)) continue;
    const match = line.match(/^(.+?)\s+(?:₹|Rs\.?|INR\s*)?([0-9]+(?:[.,][0-9]{1,2})?)\s*$/i);
    if (!match) continue;
    const name = match[1].replace(/[|*•]+/g, '').trim();
    const price = Number(match[2].replace(',', '.'));
    if (!name || !Number.isFinite(price) || price <= 0 || /\b(total|tax|gst|discount|subtotal)\b/i.test(name)) continue;
    rows.push({ name, quantity: 1, unitPrice: price });
  }
  return rows.slice(0, 60);
}

async function getTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-splitit-tesseract]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      if (window.Tesseract) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.async = true;
    script.dataset.splititTesseract = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load the browser OCR engine.'));
    document.head.appendChild(script);
  });
  if (!window.Tesseract) throw new Error('The OCR engine did not initialize.');
  return window.Tesseract;
}

export default function ItemizedExpensePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Food & Dining');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [participants, setParticipants] = useState([]);
  const [items, setItems] = useState([{ id: 1, name: '', quantity: '1', unitPrice: '', participantIds: [] }]);
  const [nextItemId, setNextItemId] = useState(2);
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/groups').then((res) => {
      setGroups(res.data);
      if (res.data.length) setGroupId(String(res.data[0].id));
    }).catch(() => showToast('error', 'Could not load groups', 'Please refresh and try again.'));
  }, []);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setParticipants([]);
      return;
    }
    api.get(`/api/groups/${groupId}`).then((res) => {
      const list = res.data.members || [];
      setMembers(list);
      const initial = list.map((member) => ({
        id: member.user_id,
        name: member.user?.full_name || member.user?.email || 'Unknown member',
        selected: true,
      }));
      setParticipants(initial);
      const payer = list.find((member) => member.user_id === user?.id) || list[0];
      setPaidBy(payer?.user_id || '');
      setItems((current) => current.map((item) => ({
        ...item,
        participantIds: initial.map((person) => person.id),
      })));
    }).catch(() => showToast('error', 'Could not load members', 'Please try selecting the group again.'));
  }, [groupId, user?.id]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  const selectedParticipants = participants.filter((person) => person.selected);
  const itemSubtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, toCents(item.unitPrice)) * Math.max(0, Number.parseInt(item.quantity, 10) || 0), 0),
    [items],
  );
  const taxCents = Math.max(0, toCents(tax));
  const discountCents = Math.max(0, toCents(discount));
  const totalCents = Math.max(0, itemSubtotalCents + taxCents - discountCents);
  const total = totalCents / 100;

  const shares = useMemo(() => {
    const totals = Object.fromEntries(selectedParticipants.map((person) => [person.id, 0]));
    for (const item of items) {
      const qty = Math.max(0, Number.parseInt(item.quantity, 10) || 0);
      const lineCents = Math.max(0, toCents(item.unitPrice)) * qty;
      const assigned = (item.participantIds || []).filter((id) => Object.hasOwn(totals, id));
      const portions = allocateCents(lineCents, assigned.map((id) => ({ id, weight: 1 })));
      for (const [id, cents] of Object.entries(portions)) totals[id] += cents;
    }
    const weights = selectedParticipants.map((person) => ({ id: person.id, weight: totals[person.id] }));
    const taxShares = allocateCents(taxCents, weights);
    const discountShares = allocateCents(discountCents, weights);
    for (const person of selectedParticipants) {
      totals[person.id] += (taxShares[person.id] || 0) - (discountShares[person.id] || 0);
    }
    return totals;
  }, [items, selectedParticipants, taxCents, discountCents]);

  const updateItem = (id, field, value) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };
  const addItem = () => {
    setItems((current) => [...current, {
      id: nextItemId,
      name: '',
      quantity: '1',
      unitPrice: '',
      participantIds: selectedParticipants.map((person) => person.id),
    }]);
    setNextItemId((id) => id + 1);
  };
  const removeItem = (id) => setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  const toggleItemParticipant = (itemId, personId) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      const currentIds = item.participantIds || [];
      return {
        ...item,
        participantIds: currentIds.includes(personId)
          ? currentIds.filter((id) => id !== personId)
          : [...currentIds, personId],
      };
    }));
  };
  const toggleParticipant = (id) => {
    setParticipants((current) => current.map((person) => person.id === id ? { ...person, selected: !person.selected } : person));
  };

  const handleReceipt = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Image required', 'For privacy, receipt OCR runs in your browser. Choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'Image too large', 'Choose a receipt image smaller than 10 MB.');
      return;
    }
    setReceiptFile(file);
  };

  const extractReceipt = async () => {
    if (!receiptFile) return;
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const Tesseract = await getTesseract();
      const result = await Tesseract.recognize(receiptFile, 'eng', {
        logger: (event) => {
          if (event.status === 'recognizing text' && event.progress != null) setOcrProgress(Math.round(event.progress * 100));
        },
      });
      const text = result.data?.text || '';
      const parsedItems = parseReceiptText(text);
      const merchantGuess = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 2 && line.length < 60);
      if (parsedItems.length) {
        setItems(parsedItems.map((item, index) => ({
          id: Date.now() + index,
          name: item.name,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice.toFixed(2)),
          participantIds: selectedParticipants.map((person) => person.id),
        })));
        setNextItemId(Date.now() + parsedItems.length + 1);
        setDescription((current) => current || (merchantGuess ? `Receipt - ${merchantGuess}` : 'Receipt expense'));
        setMerchant((current) => current || merchantGuess || '');
        showToast('success', 'Receipt scanned', `Found ${parsedItems.length} possible line items. Review every name and price before submitting.`);
      } else {
        showToast('error', 'No line items detected', 'You can still enter the items manually below. Try a sharper, well-lit image.');
      }
    } catch (error) {
      showToast('error', 'Receipt scan failed', error.message || 'Please enter the items manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const submit = async () => {
    if (!groupId || !paidBy || !description.trim()) {
      showToast('error', 'Missing details', 'Choose a group and payer, and enter an expense description.');
      return;
    }
    if (!selectedParticipants.length) {
      showToast('error', 'No participants', 'Select at least one person who owes a share.');
      return;
    }
    const validItems = items.filter((item) => item.name.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && item.unitPrice !== '');
    if (!validItems.length || validItems.length !== items.length) {
      showToast('error', 'Check the items', 'Every line item needs a name, a positive quantity, and a price.');
      return;
    }
    if (validItems.some((item) => !(item.participantIds || []).some((id) => selectedParticipants.some((person) => person.id === id)))) {
      showToast('error', 'Unassigned item', 'Assign every item to at least one selected participant.');
      return;
    }
    if (totalCents <= 0) {
      showToast('error', 'Invalid total', 'The final total must be greater than zero.');
      return;
    }
    const splits = selectedParticipants.map((person) => ({
      user_id: person.id,
      amount_owed: (shares[person.id] || 0) / 100,
    }));
    if (Math.abs(splits.reduce((sum, split) => sum + split.amount_owed, 0) - total) > 0.001) {
      showToast('error', 'Split mismatch', 'The item allocations do not add up. Review the items and charges.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/expenses', {
        group_id: Number(groupId),
        paid_by: paidBy,
        amount: total,
        description: description.trim(),
        category,
        receipt_url: null,
        expense_date: date,
        splits,
      });
      showToast('success', 'Expense submitted', `${money(total)} split by items and saved. The receipt image was not uploaded or stored.`);
      navigate('/expenses');
    } catch (error) {
      showToast('error', 'Could not create expense', error.response?.data?.detail || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Food & Dining', 'Accommodation', 'Transport', 'Entertainment', 'Shopping', 'Health', 'Bill', 'Other'];

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
        <div className="flex items-center gap-3">
          <Link to="/add-expense" className="px-3 py-2 rounded-[10px] border border-border text-text-secondary hover:bg-white/5">← Standard split</Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Itemized expense</h1>
            <p className="text-text-secondary text-sm mt-1">Scan a receipt or enter items manually, then assign each item to the people who shared it.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-5">
          <section className="bg-bg-card border border-border rounded-[20px] p-6">
            <h2 className="font-semibold mb-4">Receipt (optional)</h2>
            <div className="border-2 border-dashed border-border rounded-xl p-5">
              <label className="block text-sm font-medium mb-2">Choose a receipt image</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleReceipt(event.target.files?.[0])} className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white" />
              <p className="text-xs text-text-muted mt-3">The image stays in this browser session. OCR is processed locally; neither the image nor OCR text is sent to SplitIt’s backend or saved.</p>
              {receiptPreview && <img src={receiptPreview} alt="Selected receipt preview" className="mt-4 max-h-64 max-w-full rounded-lg border border-border object-contain" />}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button type="button" onClick={extractReceipt} disabled={!receiptFile || ocrLoading} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50">
                  {ocrLoading ? `Scanning… ${ocrProgress}%` : 'Extract items from receipt'}
                </button>
                {receiptFile && <button type="button" onClick={() => setReceiptFile(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Remove image</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <label className="text-sm text-text-secondary">Merchant / shop
                <input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="e.g. Cafe Mocha" className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
              </label>
              <label className="text-sm text-text-secondary">Expense description
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Dinner after class" className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
              </label>
            </div>
          </section>

          <section className="bg-bg-card border border-border rounded-[20px] p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold">Items</h2>
              <button type="button" onClick={addItem} className="px-3 py-2 rounded-lg border border-border text-sm font-semibold">+ Add item</button>
            </div>
            <p className="text-xs text-text-muted mb-4">OCR is only a starting point. Check every item, quantity, and price. You can use this editor without a receipt image.</p>
            <div className="flex flex-col gap-4">
              {items.map((item, index) => (
                <div key={item.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-sm font-semibold">Item {index + 1}</span>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} className="text-xs text-text-muted hover:text-red-400 disabled:opacity-30">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_76px_110px] gap-3">
                    <input aria-label={`Item ${index + 1} name`} value={item.name} onChange={(event) => updateItem(item.id, 'name', event.target.value)} placeholder="Item name" className="min-w-0 bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
                    <input aria-label={`Item ${index + 1} quantity`} type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', event.target.value)} className="bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
                    <input aria-label={`Item ${index + 1} unit price`} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, 'unitPrice', event.target.value)} placeholder="Price ₹" className="bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-text-muted mb-2">Shared by</p>
                    {participants.length === 0 ? <p className="text-xs text-text-muted">Choose a group first.</p> : (
                      <div className="flex flex-wrap gap-2">
                        {participants.filter((person) => person.selected).map((person) => {
                          const assigned = (item.participantIds || []).includes(person.id);
                          return <button key={person.id} type="button" onClick={() => toggleItemParticipant(item.id, person.id)} className={`px-2.5 py-1 rounded-full text-xs border ${assigned ? 'border-accent bg-accent-dim text-text-primary' : 'border-border text-text-muted'}`} aria-pressed={assigned}>{person.name}{assigned ? ' ✓' : ''}</button>;
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-right text-sm text-text-secondary mt-3">Line total: <strong>{money(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0))}</strong></p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <label className="text-sm text-text-secondary">Tax / service charge (₹)
                <input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
              </label>
              <label className="text-sm text-text-secondary">Discount (₹)
                <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
              </label>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="bg-bg-card border border-border rounded-[20px] p-6">
            <h2 className="font-semibold mb-4">Expense details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-text-secondary">Group
                <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg">
                  {!groups.length && <option value="">No groups</option>}
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-text-secondary">Paid by
                <select value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg">
                  {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.user?.full_name || member.user?.email || 'Unknown member'}{member.user_id === user?.id ? ' (You)' : ''}</option>)}
                </select>
              </label>
              <label className="text-sm text-text-secondary">Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg">
                  {categories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-sm text-text-secondary">Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full bg-bg-input border border-border text-text-primary px-3 py-2.5 rounded-lg" />
              </label>
            </div>
          </section>

          <section className="bg-bg-card border border-border rounded-[20px] p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold">Participants</h2>
              <button type="button" onClick={() => setParticipants((current) => current.map((person) => ({ ...person, selected: true })))} className="text-xs text-text-secondary">Select all</button>
            </div>
            <p className="text-xs text-text-muted mb-3">Select who can receive item allocations. A person's share is calculated from only the items assigned to them, plus a proportional share of tax and discount.</p>
            <div className="flex flex-col gap-2">
              {participants.map((person) => (
                <label key={person.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                  <span className="text-sm">{person.name}{person.id === user?.id ? ' (You)' : ''}</span>
                  <input type="checkbox" checked={person.selected} onChange={() => toggleParticipant(person.id)} className="h-4 w-4 accent-indigo-500" />
                </label>
              ))}
            </div>
          </section>

          <section className="bg-bg-card border border-border rounded-[20px] p-6">
            <h2 className="font-semibold mb-4">Split summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary"><span>Items subtotal</span><span>{money(itemSubtotalCents / 100)}</span></div>
              <div className="flex justify-between text-text-secondary"><span>Tax / service</span><span>{money(taxCents / 100)}</span></div>
              <div className="flex justify-between text-text-secondary"><span>Discount</span><span>−{money(discountCents / 100)}</span></div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span>{money(total)}</span></div>
            </div>
            <div className="mt-5 space-y-2">
              {selectedParticipants.map((person) => (
                <div key={person.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-text-secondary">{person.name}</span><strong>{money((shares[person.id] || 0) / 100)}</strong>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-4">The saved receipt URL remains empty. Only the final expense total and per-person amounts are sent to the existing expense API.</p>
            <div className="flex gap-3 mt-5">
              <Link to="/expenses" className="flex-1 text-center px-4 py-3 rounded-lg border border-border text-sm font-semibold">Cancel</Link>
              <button type="button" disabled={loading || ocrLoading} onClick={submit} className="flex-[2] px-4 py-3 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50">{loading ? 'Saving…' : 'Confirm & save expense'}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
