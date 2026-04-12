/**
 * /admin — redirects to /admin/import
 * The upload/import UI lives at /admin/import.
 */
import { redirect } from 'next/navigation'

export default function AdminRedirect() {
  redirect('/admin/import')
}
