import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Microsoft Fabric Embedded</h1>
      <p>Application is building successfully!</p>
      <p>Version: {import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
