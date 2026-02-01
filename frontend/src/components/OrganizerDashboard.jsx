import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Draggable from "react-draggable";
import QRCode from "react-qr-code"; 

export default function OrganizerDashboard() {
  const [menu, setMenu] = useState("events");
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [profile, setProfile] = useState({});
  const [form, setForm] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [templatePreview, setTemplatePreview] = useState(null);
  const [namePosition, setNamePosition] = useState({ x: 100, y: 100 });
  const [codePosition, setCodePosition] = useState({ x: 100, y: 150 });
  const [nameFontSize, setNameFontSize] = useState(40);
  const [isEnding, setIsEnding] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [claimUrl, setClaimUrl] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const nameRef = useRef(null);
  const codeRef = useRef(null);
  const imgRef = useRef(null);
  const token = localStorage.getItem("token");
  const userId = JSON.parse(atob(token.split(".")[1])).id;

  useEffect(() => {
    fetchEvents();
    if (menu === "profile") {
      axios.get("http://localhost:5000/api/organizer/profile", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => setProfile(res.data));
    }
  }, [menu, token]);

  useEffect(() => {
    let timer;
    if (showQRModal && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setShowQRModal(false);
    }
    return () => clearInterval(timer);
  }, [showQRModal, timeLeft]);

  const fetchEvents = () => {
    axios.get("http://localhost:5000/api/events", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => setEvents(res.data));
  };

  const handleUpdateProfile = async () => {
    try {
      await axios.put("http://localhost:5000/api/organizer/profile", profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Failed to update profile.");
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    await axios.delete(`http://localhost:5000/api/events/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setEvents(events.filter((e) => e._id !== id));
  };

  const createEvent = async () => {
    const fd = new FormData();
    Object.keys(form).forEach((k) => {
      if (k === "images" && form.images) {
        [...form.images].forEach((img) => fd.append("images", img));
      } else { fd.append(k, form[k]); }
    });
    try {
      if (form._id) {
        await axios.put(`http://localhost:5000/api/events/${form._id}`, fd, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      } else {
        await axios.post("http://localhost:5000/api/events", fd, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
      }
      setForm({}); setMenu("events"); fetchEvents();
    } catch (err) { alert("Action failed."); }
  };

  const handleEndEvent = async () => {
    if (!templateFile) return alert("Please upload a template.");
    if (!window.confirm("End event and open 10-minute claim window?")) return;

    setIsEnding(true);
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const fd = new FormData();
    fd.append("certificateTemplate", templateFile);
    fd.append("nameX", (namePosition.x * scaleX).toFixed(2));
    fd.append("nameY", (namePosition.y * scaleY).toFixed(2));
    fd.append("codeX", (codePosition.x * scaleX).toFixed(2));
    fd.append("codeY", (codePosition.y * scaleY).toFixed(2));
    fd.append("nameSize", (nameFontSize * scaleX).toFixed(2));

    try {
      await axios.post(`http://localhost:5000/api/events/${selectedEvent._id}/end`, fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      setClaimUrl(`http://localhost:3000/claim/${selectedEvent._id}`);
      setTimeLeft(600);
      setShowCertModal(false);
      setShowQRModal(true);
      fetchEvents();
    } catch (err) {
      alert("Error ending event.");
    } finally {
      setIsEnding(false);
    }
  };

  const downloadExcel = async (eventId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/events/${eventId}/report`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Event_Report_${eventId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to download report.");
    }
  };

  const isMyEvent = (event) => (typeof event.organizerId === "string" ? event.organizerId === userId : event.organizerId?._id === userId);
  const visibleEvents = filter === "my" ? events.filter(isMyEvent) : events;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white p-6 space-y-6">
        <h2 className="text-xl font-bold">Organizer Panel</h2>
        <button onClick={() => setMenu("events")} className="w-full text-left hover:text-indigo-400">Events</button>
        <button onClick={() => { setMenu("add"); setForm({}); }} className="w-full text-left hover:text-indigo-400">Add Event</button>
        <button onClick={() => setMenu("profile")} className="w-full text-left hover:text-indigo-400">My Profile</button>
        <button onClick={() => { localStorage.clear(); window.location.href = "/"; }} className="text-red-400 mt-10">Logout</button>
      </aside>

      <main className="flex-1 p-8">
        {menu === "events" && (
          <>
            <div className="flex gap-4 mb-6">
              <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded ${filter === "all" ? "bg-indigo-600 text-white" : "bg-white"}`}>All Events</button>
              <button onClick={() => setFilter("my")} className={`px-4 py-2 rounded ${filter === "my" ? "bg-indigo-600 text-white" : "bg-white"}`}>My Events</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleEvents.map((e) => (
                <motion.div key={e._id} whileHover={{ scale: 1.02 }} className="bg-white rounded-xl shadow overflow-hidden cursor-pointer relative" onClick={() => setSelectedEvent(e)}>
                  {e.status === "ended" && <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10">Completed</span>}
                  <div className="h-40 bg-gray-200">
                    {e.images?.[0] && <img src={`http://localhost:5000${e.images[0]}`} className="h-full w-full object-cover" alt="event" />}
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold truncate">{e.title}</h4>
                    <p className="text-sm text-gray-600">Registered: {e.registeredStudents?.length || 0}</p>
                    {isMyEvent(e) && (
                      <div className="flex gap-4 mt-4">
                        <button className="text-blue-600 text-sm font-medium" onClick={(ev) => { ev.stopPropagation(); setForm({ ...e }); setMenu("add"); }}>Edit</button>
                        <button onClick={(ev) => { ev.stopPropagation(); deleteEvent(e._id); }} className="text-red-600 text-sm font-medium">Delete</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {menu === "profile" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-2xl bg-white p-8 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">My Profile</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                <input disabled className="w-full p-3 bg-gray-50 border rounded-lg text-gray-500" value={profile.username || ""} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={profile.name || ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Mobile Number</label>
                <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={profile.mobile || ""} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
              </div>
              <button onClick={handleUpdateProfile} className="mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-md">
                Save Changes
              </button>
            </div>
          </motion.div>
        )}

        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-5xl rounded-xl p-6 relative flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-hidden shadow-2xl">
              <button onClick={() => setSelectedEvent(null)} className="absolute top-2 right-3 text-2xl text-gray-500">✕</button>
              <div className="md:w-1/2 h-64 md:h-auto bg-gray-100 rounded-lg overflow-hidden">
                {selectedEvent.images?.[0] && <img src={`http://localhost:5000${selectedEvent.images[0]}`} className="h-full w-full object-cover" alt="selected" />}
              </div>
              <div className="md:w-1/2 flex flex-col justify-between overflow-y-auto pr-2">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedEvent.title}</h2>
                  <div className="space-y-1 text-sm border-b pb-4">
                    <p><b>Registered Students:</b> {selectedEvent.registeredStudents?.length || 0}</p>
                    <p><b>Status:</b> <span className={selectedEvent.status === 'ended' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{selectedEvent.status?.toUpperCase() || 'ACTIVE'}</span></p>
                  </div>
                </div>
                <div className="space-y-3 mt-8">
                    {isMyEvent(selectedEvent) && selectedEvent.status !== "ended" && (
                        <button onClick={() => setShowCertModal(true)} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition">Issue Certificates</button>
                    )}
                    {isMyEvent(selectedEvent) && selectedEvent.status === "ended" && (
                        <button onClick={() => downloadExcel(selectedEvent._id)} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition">Download Excel Report</button>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showCertModal && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl p-8 relative max-h-[95vh] overflow-y-auto">
              <button onClick={() => setShowCertModal(false)} className="absolute top-4 right-4 text-2xl">✕</button>
              <h2 className="text-2xl font-bold mb-2">Configure Certificate</h2>
              <p className="text-sm text-gray-500 mb-6">Drag placeholders. A 10-minute claim QR will be generated.</p>
              
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                <input type="file" accept="image/*" className="block text-sm" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) { setTemplateFile(file); setTemplatePreview(URL.createObjectURL(file)); }
                }} />
                {templatePreview && (
                  <div className="flex-1 flex items-center gap-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <label className="text-xs font-bold text-indigo-700 uppercase">Size:</label>
                    <input type="range" min="10" max="150" value={nameFontSize} onChange={(e) => setNameFontSize(e.target.value)} className="flex-1 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
                    <span className="font-bold text-indigo-700 w-8">{nameFontSize}</span>
                  </div>
                )}
              </div>

              {templatePreview && (
                <div className="relative border-4 border-dashed rounded-xl overflow-hidden bg-gray-50 flex justify-center shadow-inner">
                  <img ref={imgRef} src={templatePreview} alt="Template" className="max-w-full h-auto select-none" />
                  <Draggable nodeRef={nameRef} bounds="parent" position={namePosition} onStop={(e, data) => setNamePosition({ x: data.x, y: data.y })}>
                    <div ref={nameRef} className="absolute cursor-move font-bold bg-white/60 px-3 py-1 border-2 border-blue-600 rounded-lg shadow-lg" style={{ fontSize: `${nameFontSize}px`, color: '#1e40af' }}>[ Student Name ]</div>
                  </Draggable>
                  <Draggable nodeRef={codeRef} bounds="parent" position={codePosition} onStop={(e, data) => setCodePosition({ x: data.x, y: data.y })}>
                    <div ref={codeRef} className="absolute cursor-move font-mono font-bold text-lg text-red-600 bg-white/60 px-2 border-2 border-red-600 rounded-md shadow-lg">ID: 000001</div>
                  </Draggable>
                </div>
              )}

              <div className="mt-8 flex justify-end gap-4">
                <button onClick={() => setShowCertModal(false)} className="px-6 py-2 text-gray-500 font-semibold">Cancel</button>
                <button disabled={!templateFile || isEnding} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold active:scale-95 shadow-lg disabled:bg-gray-400" onClick={handleEndEvent}>
                  {isEnding ? "Starting Timer..." : "Generate QR & End Event"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showQRModal && (
          <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-800">Scan to Claim</h2>
              <p className="text-gray-500 text-sm mb-6 font-medium">Valid for the next 10 minutes</p>
              
              <div className="bg-white p-4 border-2 border-gray-100 rounded-2xl shadow-inner inline-block mb-6">
                <QRCode value={claimUrl} size={200} />
              </div>

              <div className="text-3xl font-mono font-bold text-indigo-600 mb-2">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-8">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 600, ease: "linear" }}
                  className="bg-indigo-600 h-full"
                />
              </div>

              <button 
                onClick={() => { setShowQRModal(false); setSelectedEvent(null); }} 
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {menu === "add" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-xl shadow max-w-xl">
              <h3 className="font-bold mb-4">{form._id ? "Edit Event" : "Create Event"}</h3>
              <input className="w-full border p-2 mb-3 rounded" placeholder="Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="w-full border p-2 mb-3 rounded" placeholder="Description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3 mb-3">
                 <input type="date" className="border p-2 rounded" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                 <input type="date" className="border p-2 rounded" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <input type="file" multiple className="mb-4 block w-full text-sm text-gray-500" onChange={(e) => setForm({ ...form, images: e.target.files })} />
              <button onClick={createEvent} className="bg-indigo-600 text-white px-6 py-2 rounded w-full font-bold">Save Event</button>
            </motion.div>
        )}
      </main>
    </div>
  );
}