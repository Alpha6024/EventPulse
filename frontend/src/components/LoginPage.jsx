import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useRive } from "@rive-app/react-canvas";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [selectedRole, setSelectedRole] = useState("student");

  const navigate = useNavigate();

  /* ---------------- LOGIN ---------------- */
  const login = async () => {
    try {
      if (selectedRole === "admin") {
        if (username !== "" && password !== "") {
          const res = await axios.post("http://localhost:5000/api/login", {
            username,
            password,
          });

          localStorage.setItem("token", res.data.token);
          localStorage.setItem("role", "admin");
          navigate("/admin");
          return;
        } else {
          alert("Invalid admin credentials");
          return;
        }
      }

      const res = await axios.post("http://localhost:5000/api/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);

      if (res.data.role === "student") navigate("/student");
      if (res.data.role === "organizer") navigate("/organizer");
    } catch {
      alert("Invalid credentials");
    }
  };

  /* ---------------- STUDENT REGISTER ---------------- */
  const register = async () => {
    try {
      await axios.post("http://localhost:5000/api/register", {
        username,
        password,
      });

      alert("Student account created. Please login.");
      setIsSignup(false);
      setUsername("");
      setPassword("");
    } catch {
      alert("User already exists");
    }
  };

  /* ---------------- RIVE SETUP ---------------- */
  const { RiveComponent } = useRive({
    src: "anim.riv",
    autoplay: true,
    stateMachines: "Animation 1",
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-500">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        
        <div className="bg-white border-r-4 border-indigo-600 text-white flex items-center justify-center p-10 md:h-[80vh]">
          <div className="w-full h-full">
            <RiveComponent className="w-full h-full" />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="p-10 flex border-l-4 border-indigo-600 flex-col justify-start">
          {/* RADIO BUTTONS AT TOP */}
          <div className="flex justify-start gap-6 mb-6">
            {["student", "organizer", "admin"].map((role) => (
              <label key={role} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={selectedRole === role}
                  onChange={() => {
                    setSelectedRole(role);
                    setIsSignup(false);
                    setUsername("");
                    setPassword("");
                  }}
                />
                <span className="capitalize text-lg">{role}</span>
              </label>
            ))}
          </div>

          <h3 className="text-2xl font-bold mb-4 text-gray-800">
            {selectedRole} Login
          </h3>

          <input
            className="w-full border rounded-lg px-4 py-2 mb-4"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            className="w-full border rounded-lg px-4 py-2 mb-4"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* LOGIN */}
          <button
            onClick={login}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold"
          >
            Login
          </button>

          {/* STUDENT SIGNUP ONLY */}
          {selectedRole === "student" && isSignup && (
            <button
              onClick={register}
              className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold mt-3"
            >
              Create Student Account
            </button>
          )}

          {/* TOGGLE SIGNUP */}
          {selectedRole === "student" && (
            <div className="text-center mt-6">
              {!isSignup ? (
                <button
                  onClick={() => setIsSignup(true)}
                  className="text-indigo-600 font-medium"
                >
                  New student? Create account
                </button>
              ) : (
                <button
                  onClick={() => setIsSignup(false)}
                  className="text-indigo-600 font-medium"
                >
                  Back to login
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
