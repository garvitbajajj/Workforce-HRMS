import { useState } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Badge, Modal, FormField, Input, Btn } from '../components/Layout.jsx'
import { format, parseISO } from 'date-fns'

export default function Holidays() {
  const { state, dispatch, viewMode } = useHRMS()
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const isManager = ['admin', 'hr'].includes(currentUser?.role) && viewMode === 'admin'

  // Default to employee's work location, or 'All'
  const userLoc = employee?.workLocation || ''
  const validLocations = ['pune', 'indore', 'noida', 'bangalore']
  const initialLocFilter = validLocations.includes(userLoc.toLowerCase()) ? userLoc : ''

  const [locFilter, setLocFilter] = useState(initialLocFilter)
  const [showAdd, setShowAdd] = useState(false)
  const [editHoliday, setEditHoliday] = useState(null)

  // Filter and sort holidays
  const filteredHolidays = state.holidays
    .filter(h => {
      if (!locFilter) return true
      const key = locFilter.toLowerCase()
      return h[key] === true
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this holiday?')) {
      dispatch({ type: 'DELETE_HOLIDAY', id })
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Holiday Calendar</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>View and manage company-wide public holidays</p>
        </div>
        {isManager && (
          <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Holiday</Btn>
        )}
      </div>

      {/* Filter Card */}
      {isManager && (
        <Card style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Filter Location:</span>
            <select 
              value={locFilter} 
              onChange={e => setLocFilter(e.target.value)} 
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'white', outline: 'none', minWidth: 160 }}
            >
              <option value="">All Locations</option>
              <option value="Pune">Pune</option>
              <option value="Indore">Indore</option>
              <option value="Noida">Noida</option>
              <option value="Bangalore">Bangalore</option>
            </select>
          </div>
        </Card>
      )}

      {/* Holiday Table/List */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filteredHolidays.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
            No holidays found for your location.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Holiday Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                  {isManager && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pune</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Indore</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Noida</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bangalore</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredHolidays.map(h => (
                  <tr key={h.id || h.date} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {h.name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text2)' }}>
                      {format(parseISO(h.date), 'EEE, dd MMM yyyy')}
                    </td>
                    {isManager && (
                      <>
                        <td style={{ padding: '14px 16px' }}>
                          {h.pune ? <Badge color="success">Active</Badge> : <Badge color="gray">NA</Badge>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {h.indore ? <Badge color="success">Active</Badge> : <Badge color="gray">NA</Badge>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {h.noida ? <Badge color="success">Active</Badge> : <Badge color="gray">NA</Badge>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {h.bangalore ? <Badge color="success">Active</Badge> : <Badge color="gray">NA</Badge>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Btn variant="ghost" size="sm" onClick={() => setEditHoliday(h)} style={{ padding: '4px 8px' }}>Edit</Btn>
                            <Btn variant="danger" size="sm" onClick={() => handleDelete(h.id)} style={{ padding: '4px 8px' }}>Delete</Btn>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Holiday Modal */}
      {showAdd && (
        <HolidayFormModal 
          title="Add New Holiday" 
          onClose={() => setShowAdd(false)} 
          onSubmit={(holiday) => {
            dispatch({ type: 'ADD_HOLIDAY', holiday })
            setShowAdd(false)
          }}
        />
      )}

      {/* Edit Holiday Modal */}
      {editHoliday && (
        <HolidayFormModal 
          title="Edit Holiday" 
          holiday={editHoliday}
          onClose={() => setEditHoliday(null)} 
          onSubmit={(holiday) => {
            dispatch({ type: 'EDIT_HOLIDAY', holiday: { ...holiday, id: editHoliday.id } })
            setEditHoliday(null)
          }}
        />
      )}
    </div>
  )
}

function HolidayFormModal({ title, holiday, onClose, onSubmit }) {
  const { throwUIError } = useHRMS()
  const [form, setForm] = useState({
    name: holiday?.name || '',
    date: holiday?.date || '',
    pune: holiday ? !!holiday.pune : true,
    indore: holiday ? !!holiday.indore : true,
    noida: holiday ? !!holiday.noida : true,
    bangalore: holiday ? !!holiday.bangalore : true,
  })

  const handleCheckbox = (key) => {
    setForm(f => ({ ...f, [key]: !f[key] }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) {
      throwUIError(new Error('Please fill in holiday name and date.'))
      return
    }
    onSubmit(form)
  }

  return (
    <Modal title={title} onClose={onClose} width={450}>
      <form onSubmit={handleSubmit}>
        <FormField label="Holiday Name *">
          <Input 
            value={form.name} 
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
            placeholder="e.g. Diwali" 
            required 
          />
        </FormField>
        
        <FormField label="Date *">
          <Input 
            type="date"
            value={form.date} 
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} 
            required 
          />
        </FormField>

        <FormField label="Applicable Locations">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '4px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.pune} onChange={() => handleCheckbox('pune')} />
              Pune Office
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.indore} onChange={() => handleCheckbox('indore')} />
              Indore Office
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.noida} onChange={() => handleCheckbox('noida')} />
              Noida Office
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.bangalore} onChange={() => handleCheckbox('bangalore')} />
              Bangalore Office
            </label>
          </div>
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary">Save Holiday</Btn>
        </div>
      </form>
    </Modal>
  )
}
