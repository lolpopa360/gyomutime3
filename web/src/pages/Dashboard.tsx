import Uploader from '../components/Uploader'
import SubmissionsList from '../components/SubmissionsList'
import AdminPanel from '../components/AdminPanel'
import SuperAdminPanel from '../components/SuperAdminPanel'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <Uploader />
      <SubmissionsList />
      <AdminPanel />
      <SuperAdminPanel />
    </div>
  )
}

