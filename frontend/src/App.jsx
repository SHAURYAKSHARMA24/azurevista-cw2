import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const emptyForm = {
  file: null,
  title: '',
  description: '',
  tags: '',
  visibility: 'public'
};

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function normalizeTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Recently';
}

function App() {
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [assets]);

  async function request(path, options = {}) {
    let response;

    if (!API_BASE_URL) {
      throw new Error('VITE_API_BASE_URL is not configured for this frontend build.');
    }

    try {
      response = await fetch(`${API_BASE_URL}${path}`, options);
    } catch {
      throw new Error(`Could not reach the Azure Functions API at ${API_BASE_URL}. Check the API is running and VITE_API_BASE_URL is correct.`);
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed with status ${response.status}`);
    }

    return payload;
  }

  async function loadAssets(showMessage = false) {
    setLoading(true);
    setError('');
    if (showMessage) setMessage('');

    try {
      const data = await request('/assets');
      setAssets(data.assets || []);
      if (showMessage) setMessage('Asset feed refreshed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(asset) {
    setEditingId(asset.id);
    setEditForm({
      title: asset.title || '',
      description: asset.description || '',
      tags: tagsToText(asset.tags),
      visibility: asset.visibility || 'public'
    });
    setMessage('');
    setError('');
  }

  async function handleUpload(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (!form.file) {
        throw new Error('Choose an image file before uploading.');
      }

      if (!form.title.trim()) {
        throw new Error('Add a title before uploading.');
      }

      const body = new FormData();
      body.append('file', form.file);
      body.append('title', form.title);
      body.append('description', form.description);
      body.append('tags', form.tags);
      body.append('visibility', form.visibility);

      const created = await request('/assets', {
        method: 'POST',
        body
      });

      setAssets((current) => [created, ...current]);
      setForm(emptyForm);
      event.target.reset();
      setMessage('Image uploaded successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(assetId) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (!editForm.title.trim()) {
        throw new Error('Asset title cannot be empty.');
      }

      const updated = await request(`/assets/${assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          tags: normalizeTags(editForm.tags),
          visibility: editForm.visibility
        })
      });

      setAssets((current) => current.map((asset) => (asset.id === assetId ? updated : asset)));
      setEditingId(null);
      setMessage('Asset metadata updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(assetId) {
    const confirmed = window.confirm('Delete this asset and its Blob image if possible?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await request(`/assets/${assetId}`, {
        method: 'DELETE'
      });

      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setMessage('Asset deleted from Cosmos DB and Blob cleanup was attempted.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">COM682 Coursework 2</p>
          <h1>AzureVista</h1>
          <p className="intro">
            Azure cloud-native image sharing built with React, Azure Functions, Blob Storage, Cosmos DB, and Application Insights.
          </p>
          <div className="service-strip" aria-label="Azure services used">
            <span>Azure Functions</span>
            <span>Blob Storage</span>
            <span>Cosmos DB NoSQL</span>
            <span>Application Insights</span>
          </div>
        </div>
        <div className="header-actions">
          <span className="api-pill">{API_BASE_URL}</span>
          <button type="button" className="secondary-button" onClick={() => loadAssets(true)} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="upload-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Create Asset</p>
            <h2>Upload Image Metadata</h2>
          </div>
          <span className="record-count">{sortedAssets.length} active records</span>
        </div>

        <form className="upload-form" onSubmit={handleUpload}>
          <div className="field">
            <label htmlFor="file">Image file</label>
            <input
              id="file"
              type="file"
              accept="image/*"
              required
              onChange={(event) => updateForm('file', event.target.files?.[0] || null)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} required onChange={(event) => updateForm('title', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="visibility">Visibility</label>
              <select id="visibility" value={form.visibility} onChange={(event) => updateForm('visibility', event.target.value)}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              rows="3"
            />
          </div>

          <div className="field">
            <label htmlFor="tags">Tags</label>
            <input
              id="tags"
              value={form.tags}
              placeholder="azure, cloud, portfolio"
              onChange={(event) => updateForm('tags', event.target.value)}
            />
          </div>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Upload image'}
          </button>
        </form>
      </section>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      {loading && <div className="alert neutral">Loading assets...</div>}

      <section className="feed-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cosmos DB Feed</p>
            <h2>Asset Gallery</h2>
          </div>
        </div>

        <div className="gallery" aria-live="polite">
          {sortedAssets.length === 0 && !loading ? (
            <div className="empty-state">No assets yet. Upload an image to create the first Blob file and Cosmos DB metadata record.</div>
          ) : (
            sortedAssets.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <div className="asset-image-wrap">
                  <img src={asset.blobUrl} alt={asset.title || 'Uploaded asset'} />
                </div>

                {editingId === asset.id ? (
                  <div className="asset-body">
                    <div className="field compact">
                      <label>Title</label>
                      <input value={editForm.title} required onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
                    </div>
                    <div className="field compact">
                      <label>Description</label>
                      <textarea
                        rows="3"
                        value={editForm.description}
                        onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                      />
                    </div>
                    <div className="field compact">
                      <label>Tags</label>
                      <input value={editForm.tags} onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })} />
                    </div>
                    <div className="field compact">
                      <label>Visibility</label>
                      <select value={editForm.visibility} onChange={(event) => setEditForm({ ...editForm, visibility: event.target.value })}>
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    <div className="button-row">
                      <button type="button" className="primary-button" onClick={() => handleEditSubmit(asset.id)} disabled={saving}>
                        Save
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setEditingId(null)} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="asset-body">
                    <div className="asset-title-row">
                      <h3>{asset.title || 'Untitled image'}</h3>
                      <span className="visibility-pill">{asset.visibility}</span>
                    </div>
                    <p>{asset.description || 'No description provided.'}</p>
                    <div className="tag-list">
                      {(asset.tags || []).length > 0 ? (asset.tags || []).map((tag) => <span key={tag}>{tag}</span>) : <span>No tags</span>}
                    </div>
                    <dl className="asset-meta">
                      <div>
                        <dt>Asset ID</dt>
                        <dd>{asset.assetId || asset.id}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDate(asset.createdAt)}</dd>
                      </div>
                    </dl>
                    <div className="button-row">
                      <button type="button" className="secondary-button" onClick={() => startEditing(asset)} disabled={saving}>
                        Edit
                      </button>
                      <button type="button" className="danger-button" onClick={() => handleDelete(asset.id)} disabled={saving}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
