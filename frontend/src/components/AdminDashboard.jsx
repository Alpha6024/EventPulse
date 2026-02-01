import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [menu, setMenu] = useState("stats");
  const [stats, setStats] = useState({ students: 0, organizers: 0, totalEvents: 0 }); // UPDATED: added totalEvents
  const [users, setUsers] = useState([]);
  const [eventData, setEventData] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reportSearch, setReportSearch] = useState(""); // NEW: Search for report page

  const token = localStorage.getItem("token");

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "student",
    email: "",
  });

  const fetchEventReport = async () => {
    const res = await axios.get("http://localhost:5000/api/admin/events-report", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setEventData(res.data);
  };

  const downloadExcel = () => {
    const headers = ["Event Title", "Organizer", "Mobile", "Registered", "Claimed"];
    const rows = filteredReport.map(e => [
      e.title,
      e.organizer,
      `'${e.mobile}`,
      e.registered,
      e.claimed
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(row => row.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Global_Event_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createUser = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/admin/create-user",
        newUser,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("User created successfully");
      setNewUser({ username: "", password: "", role: "student", email: "" });
      setMenu("users");
      fetchUsers();
    } catch (err) { alert("Failed to create user"); }
  };

  const fetchStats = async () => {
    const res = await axios.get("http://localhost:5000/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setStats(res.data);
  };

  const fetchUsers = async () => {
    const res = await axios.get("http://localhost:5000/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers(res.data);
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    await axios.delete(`http://localhost:5000/api/admin/user/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  useEffect(() => {
    if (menu === "stats") fetchStats();
    if (menu === "users") fetchUsers();
    if (menu === "viewData") fetchEventReport();
  }, [menu]);

  const filteredUsers = users.filter((u) => {
    const roleMatch = filter === "all" || u.role === filter;
    const searchMatch = u.username?.toLowerCase().includes(search.toLowerCase());
    return roleMatch && searchMatch;
  });


  const filteredReport = eventData.filter((e) => 
    e.title.toLowerCase().includes(reportSearch.toLowerCase()) || 
    e.organizer.toLowerCase().includes(reportSearch.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
     
      <div className="w-64 bg-gray-900 text-white p-6">
        <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
        <button onClick={() => setMenu("stats")} className={`block w-full text-left px-4 py-2 rounded mb-2 ${menu === "stats" ? "bg-blue-600" : "hover:bg-gray-700"}`}>
          Dashboard Stats
        </button>
        <button onClick={() => setMenu("users")} className={`block w-full text-left px-4 py-2 rounded mb-2 ${menu === "users" ? "bg-blue-600" : "hover:bg-gray-700"}`}>
          All Users
        </button>
        <button onClick={() => setMenu("viewData")} className={`block w-full text-left px-4 py-2 rounded mb-2 ${menu === "viewData" ? "bg-blue-600" : "hover:bg-gray-700"}`}>
          View & Download Data
        </button>
        <button onClick={() => setMenu("addUser")} className={`block w-full text-left px-4 py-2 rounded ${menu === "addUser" ? "bg-blue-600" : "hover:bg-gray-700"}`}>
          Add User
        </button>
        <button onClick={() => { localStorage.clear(); window.location.href = "/"; }} className="text-red-400 mt-10 block w-full text-left px-4 py-2">Logout</button>
      </div>

  
      <div className="flex-1 p-8">
        {menu === "stats" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-gray-600">Total Students</h3>
              <p className="text-4xl font-bold text-blue-600">{stats.students}</p>
            </div>
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-gray-600">Total Organizers</h3>
              <p className="text-4xl font-bold text-green-600">{stats.organizers}</p>
            </div>
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold text-gray-600">Total Events</h3>
              <p className="text-4xl font-bold text-purple-600">{stats.totalEvents || 0}</p>
            </div>
          </motion.div>
        )}

        {menu === "viewData" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded shadow">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold">Event & Certificate Reports</h3>
                <p className="text-sm text-gray-500">Track registration and certificate claims globally</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Search events or organizers..." 
                  className="border p-2 rounded text-sm w-full md:w-64"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
                <button onClick={downloadExcel} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 whitespace-nowrap text-sm">
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-3 border text-left">Event Title</th>
                    <th className="p-3 border text-left">Organizer</th>
                    <th className="p-3 border text-left">Mobile</th>
                    <th className="p-3 border text-center">Registered</th>
                    <th className="p-3 border text-center">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReport.length > 0 ? filteredReport.map((e, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border font-medium">{e.title}</td>
                      <td className="p-3 border">{e.organizer}</td>
                      <td className="p-3 border">{e.mobile}</td>
                      <td className="p-3 border text-center font-bold text-blue-600">{e.registered}</td>
                      <td className="p-3 border text-center font-bold text-green-600">{e.claimed}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="p-10 text-center text-gray-400">No matching records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {menu === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded shadow">
            <div className="flex flex-wrap gap-4 mb-4">
              <select className="border p-2 rounded" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="organizer">Organizer</option>
              </select>
              <input type="text" placeholder="Search by username" className="border p-2 rounded flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 border">Username</th>
                    <th className="p-2 border">Role</th>
                    <th className="p-2 border">Email</th>
                    <th className="p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="text-center">
                      <td className="p-2 border">{u.username}</td>
                      <td className="p-2 border">{u.role}</td>
                      <td className="p-2 border">{u.email || "-"}</td>
                      <td className="p-2 border">
                        <button onClick={() => deleteUser(u._id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {menu === "addUser" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded shadow max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Add Student / Organizer</h3>
            <input className="border p-2 rounded w-full mb-3" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
            <input type="password" className="border p-2 rounded w-full mb-3" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            <input className="border p-2 rounded w-full mb-3" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <select className="border p-2 rounded w-full mb-4" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="organizer">Organizer</option>
            </select>
            <button onClick={createUser} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Create User</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}