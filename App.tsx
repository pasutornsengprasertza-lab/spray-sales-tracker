import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// 🔑 ใส่คีย์จากหน้าจอล่าสุดของคุณให้เรียบร้อยแล้วครับ!
// ==========================================
const SUPABASE_URL = "https://zbbjmtebaxktmxbpvfrq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mchXaKbfkeZchE6m_7wXUw_8rvt_--"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COST_PER_UNIT = 94; //
const SELL_PRICE = 149; //
const TOTAL_STOCK = 16; //

const DAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"]; //

function getTodayTH() { //
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear() - 2500 + 543;
  const day = DAYS_TH[now.getDay()];
  return { date: `${d}/${m}/${y}`, day };
}

export default function App() {
  const [orders, setOrders] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false); //
  const [filterDate, setFilterDate] = useState(""); //
  const [form, setForm] = useState({ //
    customer: "",
    qty: 1,
    amount: SELL_PRICE,
    paid: false,
    shipped: false,
    note: "",
  });

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("id", { ascending: false });
    
    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const subscription = supabase
      .channel("orders_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const totalSold = orders.reduce((s, o) => s + Number(o.qty), 0); //
  const totalRevenue = orders.reduce((s, o) => (o.paid ? s + Number(o.amount) : s), 0); //
  const totalProfit = totalRevenue - orders.filter(o => o.paid).reduce((s, o) => s + Number(o.qty) * COST_PER_UNIT, 0); //
  const remaining = TOTAL_STOCK - totalSold; //
  const pendingPayment = orders.filter(o => !o.paid).reduce((s, o) => s + Number(o.amount), 0); //

  const grouped = orders
    .filter(o => !filterDate || o.date.includes(filterDate)) //
    .reduce((acc, o) => {
      const key = `${o.date}|${o.day}`; //
      if (!acc[key]) acc[key] = []; //
      acc[key].push(o); //
      return acc;
    }, {});

  async function handleAdd() {
    if (!form.customer.trim()) return alert("กรุณากรอกชื่อลูกค้า");
    
    const { date, day } = getTodayTH();
    const newOrder = {
      date,
      day,
      customer: form.customer,
      qty: Number(form.qty),
      amount: Number(form.amount),
      paid: form.paid,
      shipped: form.shipped,
      note: form.note,
    };

    const { error } = await supabase.from("orders").insert([newOrder]);
    if (error) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    } else {
      setForm({ customer: "", qty: 1, amount: SELL_PRICE, paid: false, shipped: false, note: "" }); //
      setShowForm(false); //
    }
  }

  async function togglePaid(id) {
    const currentOrder = orders.find(o => o.id === id);
    if (!currentOrder) return;
    
    const { error } = await supabase
      .from("orders")
      .update({ paid: !currentOrder.paid })
      .eq("id", id);
    if (error) alert("ไม่สามารถอัปเดตสถานะเงินได้");
  }

  async function toggleShipped(id) {
    const currentOrder = orders.find(o => o.id === id);
    if (!currentOrder) return;

    const { error } = await supabase
      .from("orders")
      .update({ shipped: !currentOrder.shipped })
      .eq("id", id);
    if (error) alert("ไม่สามารถอัปเดตสถานะการจัดส่งได้");
  }

  async function deleteOrder(id) {
    if (confirm("คุณแน่ใจใช่ไหมที่จะลบออเดอร์นี้?")) {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) alert("ไม่สามารถลบออเดอร์ได้");
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Sarabun', sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", display: "flex", justifyContent: "center", alignItems: "center" }}>
        กำลังเชื่อมต่อข้อมูลเรียลไทม์... 🔄
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Sarabun', sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", padding: "16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "28px", fontWeight: "700", color: "#38bdf8", letterSpacing: "1px" }}>🧴 SPRAY TRACKER</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>by เจมส์ × เซฟ</div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
        <StatCard label="สต็อกคงเหลือ" value={`${remaining}/${TOTAL_STOCK}`} sub="ขวด" color="#38bdf8" />
        <StatCard label="รายได้รับแล้ว" value={`฿${totalRevenue}`} sub={`${orders.filter(o=>o.paid).length} ออเดอร์`} color="#4ade80" />
        <StatCard label="กำไรสุทธิ" value={`฿${totalProfit}`} sub="หักต้นทุนแล้ว" color="#a78bfa" />
        <StatCard label="รอรับยอด" value={`฿${pendingPayment}`} sub={`${orders.filter(o=>!o.paid).length} ออเดอร์`} color="#fb923c" />
      </div>

      {/* Progress Bar */}
      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
          <span>ขายไปแล้ว {totalSold} ขวด</span>
          <span>เป้า {TOTAL_STOCK} ขวด</span>
        </div>
        <div style={{ background: "#0f172a", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
          <div style={{ width: `${Math.min((totalSold / TOTAL_STOCK) * 100, 100)}%`, background: "linear-gradient(90deg, #38bdf8, #818cf8)", height: "100%", borderRadius: "999px", transition: "width 0.4s" }} />
        </div>
        <div style={{ textAlign: "center", fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{Math.round((totalSold / TOTAL_STOCK) * 100)}%</div>
      </div>

      {/* Filter + Add */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          placeholder="🔍 ค้นหาวันที่ เช่น 11/07"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "10px 12px", color: "#e2e8f0", fontSize: "13px", outline: "none" }}
        />
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: "#38bdf8", color: "#0f172a", border: "none", borderRadius: "10px", padding: "10px 16px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
        >
          {showForm ? "ปิด" : "+ เพิ่ม"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "16px", marginBottom: "16px", border: "1px solid #334155" }}>
          <div style={{ fontWeight: "700", color: "#38bdf8", marginBottom: "12px", fontSize: "14px" }}>📝 เพิ่มออเดอร์ใหม่</div>
          <input placeholder="ชื่อลูกค้า" value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))}
            style={inputStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input type="number" placeholder="จำนวน (ขวด)" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
              style={inputStyle} />
            <input type="number" placeholder="ยอดรับ (บาท)" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={inputStyle} />
          </div>
          <input placeholder="หมายเหตุ (ถ้ามี)" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            style={inputStyle} />
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <Toggle label="รับยอดแล้ว" checked={form.paid} onChange={() => setForm(p => ({ ...p, paid: !p.paid }))} color="#4ade80" />
            <Toggle label="ส่งแล้ว" checked={form.shipped} onChange={() => setForm(p => ({ ...p, shipped: !p.shipped }))} color="#38bdf8" />
          </div>
          <button onClick={handleAdd}
            style={{ width: "100%", background: "#38bdf8", color: "#0f172a", border: "none", borderRadius: "10px", padding: "12px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>
            ✅ บันทึกออเดอร์
          </button>
        </div>
      )}

      {/* Orders by Date */}
      {Object.entries(grouped).sort((a, b) => a[0] < b[0] ? 1 : -1).map(([key, dayOrders]) => {
        const [date, day] = key.split("|");
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ background: "#1e293b", borderRadius: "8px", padding: "4px 12px", fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>
                📅 {date} วัน{day}
              </div>
              <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
            </div>
            {dayOrders.map(order => (
              <div key={order.id} style={{ background: "#1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "8px", borderLeft: `3px solid ${order.paid ? "#4ade80" : "#fb923c"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#f1f5f9" }}>
                      {order.customer}
                      {order.note ? <span style={{ marginLeft: "6px", fontSize: "11px", color: "#94a3b8", fontWeight: "400" }}>({order.note})</span> : null}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{order.qty} ขวด × ฿{Math.round(order.amount / order.qty)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: "700", fontSize: "16px", color: order.paid ? "#4ade80" : "#fb923c" }}>฿{order.amount}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>กำไร ฿{order.amount - order.qty * COST_PER_UNIT}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                  <Badge label={order.paid ? "✅ รับยอดแล้ว" : "⏳ ยังไม่รับยอด"} color={order.paid ? "#4ade80" : "#fb923c"} onClick={() => togglePaid(order.id)} />
                  <Badge label={order.shipped ? "📦 ส่งแล้ว" : "🕐 ยังไม่ส่ง"} color={order.shipped ? "#38bdf8" : "#94a3b8"} onClick={() => toggleShipped(order.id)} />
                  <Badge label="🗑️" color="#ef4444" onClick={() => deleteOrder(order.id)} />
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {orders.length === 0 && (
        <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: "14px" }}>ยังไม่มีออเดอร์ครับเซฟ 📭</div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) { //
  return ( //
    <div style={{ background: "#1e293b", borderRadius: "12px", padding: "12px 14px" }}> //
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{label}</div> //
      <div style={{ fontSize: "20px", fontWeight: "700", color }}>{value}</div> //
      <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{sub}</div> //
    </div> //
  ); //
} //

function Badge({ label, color, onClick }) { //
  return ( //
    <button onClick={onClick} style={{ background: "transparent", border: `1px solid ${color}`, color, borderRadius: "6px", padding: "3px 8px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}> //
      {label} //
    </button> //
  ); //
} //

function Toggle({ label, checked, onChange, color }) { //
  return ( //
    <button onClick={onChange} style={{ flex: 1, background: checked ? color + "22" : "#0f172a", border: `1px solid ${checked ? color : "#334155"}`, color: checked ? color : "#64748b", borderRadius: "8px", padding: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}> //
      {checked ? "✅" : "⬜"} {label} //
    </button> //
  ); //
} //

const inputStyle = { //
  width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", //
  padding: "10px 12px", color: "#e2e8f0", fontSize: "13px", outline: "none", //
  marginBottom: "8px", boxSizing: "border-box", fontFamily: "inherit" //
};
