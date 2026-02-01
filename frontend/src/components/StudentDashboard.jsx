import { useEffect, useState } from "react";
import axios from "axios";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function StudentDashboard() {
  const [menu, setMenu] = useState("events");
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [profile, setProfile] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const token = localStorage.getItem("token");
  if (!token) window.location.href = "/";

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const handleUnauthorized = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (menu === "events" || menu === "myEvents") {
          const res = await axios.get("http://localhost:5000/api/events", authHeader);
          setEvents(res.data);
          const myRes = await axios.get("http://localhost:5000/api/student/my-events", authHeader);
          setMyEvents(myRes.data);
        }
        if (menu === "profile") {
          const res = await axios.get("http://localhost:5000/api/student/profile", authHeader);
          setProfile(res.data);
        }
      } catch (err) {
        if (err.response?.status === 401) handleUnauthorized();
      }
    };
    fetchData();
  }, [menu]);
  useEffect(() => {
    let scanner = null;
    if (showScanner) {
      scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
      });

      scanner.render((decodedText) => {
       
        const parts = decodedText.split("/");
        const eventId = parts[parts.length - 1];
        
        if (eventId) {
          scanner.clear();
          setShowScanner(false);
          handleClaimCertificate(eventId);
        }
      }, (error) => {
       
      });
    }
    return () => { if (scanner) scanner.clear(); };
  }, [showScanner]);

  const handleClaimCertificate = async (eventId) => {
    try {
      await axios.post(`http://localhost:5000/api/events/${eventId}/claim`, {}, authHeader);
      alert("Certificate claimed successfully!");
      
      const myRes = await axios.get("http://localhost:5000/api/student/my-events", authHeader);
      setMyEvents(myRes.data);
  
      const event = myRes.data.find(e => e._id === eventId);
      if (event) downloadCertificate(eventId, event.title);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to claim certificate. Ensure the 10-min window is open.");
    }
  };

  const filterEvents = (list) =>
    list.filter(
      (e) =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())
    );

  const registerEvent = async (id) => {
    try {
      await axios.post(`http://localhost:5000/api/events/register/${id}`, {}, authHeader);
      const [allRes, myRes] = await Promise.all([
        axios.get("http://localhost:5000/api/events", authHeader),
        axios.get("http://localhost:5000/api/student/my-events", authHeader),
      ]);
      setEvents(allRes.data);
      setMyEvents(myRes.data);
      alert("Registered successfully");
      setSelectedEvent(null);
    } catch {
      alert("Already registered or failed");
    }
  };

  const unregisterEvent = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/events/unregister/${id}`, authHeader);
      const [allRes, myRes] = await Promise.all([
        axios.get("http://localhost:5000/api/events", authHeader),
        axios.get("http://localhost:5000/api/student/my-events", authHeader),
      ]);
      setEvents(allRes.data);
      setMyEvents(myRes.data);
      alert("Unregistered successfully");
      setSelectedEvent(null);
    } catch {
      alert("Failed to unregister");
    }
  };

  const downloadCertificate = async (eventId, eventTitle) => {
    try {
      const userId = JSON.parse(atob(token.split(".")[1])).id;
      const certUrl = `http://localhost:5000/uploads/cert-${eventId}-${userId}.png`;
      const response = await fetch(certUrl);
      if (!response.ok) throw new Error("File not found");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Certificate_${eventTitle.replace(/\s+/g, '_')}.png`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Certificate not available. Ensure you scanned the QR code during the claim window.");
    }
  };

  const updateProfile = async () => {
    try {
      await axios.put("http://localhost:5000/api/student/profile", {
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
      }, authHeader);
      alert("Profile updated");
    } catch {
      alert("Update failed");
    }
  };

  const isRegistered = (id) => myEvents.some((e) => e._id === id);

  const getCertificateCode = (event) => {
    const userId = JSON.parse(atob(token.split(".")[1])).id;
    const index = event.registeredStudents.findIndex(s => 
        (typeof s === 'string' ? s === userId : s._id === userId)
    );
    return index !== -1 ? String(index + 1).padStart(6, '0') : "N/A";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white p-6 space-y-6">
        <h2 className="text-xl font-bold">Student Panel</h2>
        <button onClick={() => setMenu("events")} className="w-full text-left hover:text-indigo-400">Events</button>
        <button onClick={() => setMenu("myEvents")} className="w-full text-left hover:text-indigo-400">My Events</button>
        <button onClick={() => setShowScanner(true)} className="w-full text-left text-green-400 font-bold hover:text-green-300">Scan QR to Claim</button>
        <button onClick={() => setMenu("profile")} className="w-full text-left hover:text-indigo-400">Profile</button>
        <button onClick={() => { localStorage.clear(); window.location.href = "/"; }} className="text-red-400 mt-10">Logout</button>
      </aside>

      <main className="flex-1 p-8">
        <input
          type="text"
          placeholder="Search events..."
          className="border p-2 rounded mb-4 w-full shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {menu === "events" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filterEvents(events).map((e) => (
              <div key={e._id} onClick={() => setSelectedEvent(e)} className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden cursor-pointer relative">
                {e.status === "ended" && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase z-10 shadow">Ended</div>
                )}
                <div className="h-40 bg-gray-200">
                  {e.images?.[0] && <img src={`http://localhost:5000${e.images[0]}`} className="h-full w-full object-cover" alt="event" />}
                </div>
                <div className="p-4">
                  <h3 className="font-bold truncate">{e.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {menu === "myEvents" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filterEvents(myEvents).map((e) => (
              <div key={e._id} onClick={() => setSelectedEvent(e)} className="bg-white rounded-xl shadow overflow-hidden cursor-pointer">
                <div className="h-40 bg-gray-200">
                  {e.images?.[0] && <img src={`http://localhost:5000${e.images[0]}`} className="h-full w-full object-cover" alt="event" />}
                </div>
                <div className="p-4">
                  <h3 className="font-bold truncate">{e.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1 mb-2">{e.description}</p>
                  
                  {e.status === "ended" && (
                    <div className="mt-2 pt-2 border-t">
                      <button 
                        onClick={(ev) => { ev.stopPropagation(); downloadCertificate(e._id, e.title); }}
                        className="w-full bg-green-600 text-white text-xs py-2.5 rounded-lg font-bold hover:bg-green-700 transition shadow-sm"
                      >
                        Download Certificate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {menu === "profile" && (
          <div className="bg-white p-6 rounded-xl shadow grid grid-cols-2 gap-4">
            <div className="flex flex-col">
               <label className="text-xs font-bold text-gray-400 mb-1 uppercase">Username</label>
               <input value={profile.username || ""} disabled className="border p-2 rounded bg-gray-50 text-gray-500" />
            </div>
            <div className="flex flex-col">
               <label className="text-xs font-bold text-gray-400 mb-1 uppercase">Full Name</label>
               <input value={profile.name || ""} placeholder="Name" className="border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="flex flex-col">
               <label className="text-xs font-bold text-gray-400 mb-1 uppercase">Email Address</label>
               <input value={profile.email || ""} placeholder="Email" className="border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="flex flex-col">
               <label className="text-xs font-bold text-gray-400 mb-1 uppercase">Mobile Number</label>
               <input value={profile.mobile || ""} placeholder="Mobile" className="border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
            </div>
            <button onClick={updateProfile} className="col-span-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition mt-2 shadow-md">Update Profile Information</button>
          </div>
        )}
      </main>


      {showScanner && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Scan Organizer QR</h2>
              <button onClick={() => setShowScanner(false)} className="text-gray-500 text-xl">✕</button>
            </div>
            <div id="reader" className="overflow-hidden rounded-lg"></div>
            <p className="text-center text-xs text-gray-500 mt-4">Point your camera at the certificate claim QR code</p>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-3 right-4 text-2xl text-gray-400 hover:text-black z-20">✕</button>
            <div className="h-48 bg-gray-200 flex-shrink-0 relative">
               {selectedEvent.images?.[0] && <img src={`http://localhost:5000${selectedEvent.images[0]}`} className="h-full w-full object-cover" alt="header" />}
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">{selectedEvent.title}</h2>
              <h4 className="font-bold text-gray-700 mb-1 text-sm uppercase">Description</h4>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{selectedEvent.description}</p>
            </div>
            <div className="p-6 border-t bg-gray-50 flex-shrink-0">
              {selectedEvent.status === "ended" ? (
                <div className="flex flex-col gap-3">
                  {isRegistered(selectedEvent._id) && (
                    <button onClick={() => downloadCertificate(selectedEvent._id, selectedEvent.title)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg">Download My Certificate</button>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  {!isRegistered(selectedEvent._id) ? (
                    <button onClick={() => registerEvent(selectedEvent._id)} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition">Register Now</button>
                  ) : (
                    <button onClick={() => unregisterEvent(selectedEvent._id)} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 shadow-md transition">Cancel Registration</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}