import React, { useState } from 'react';

const PlanForm = ({ planData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: planData?.name || '',
    description: planData?.description || '',
    isUnlimited: planData?.dataLimit?.isUnlimited || false,
    dataLimit: planData?.dataLimit?.bytes
      ? (planData.dataLimit.bytes / (1024 * 1024 * 1024)).toFixed(2)
      : '',
    price: planData?.price || 0,
    currency: planData?.currency || 'USD',
    billingCycle: planData?.billingCycle || '1-month',
    expiryMonths: planData?.expiryMonths || 1,
    features: planData?.features?.join(', ') || '',
    isActive: planData?.isActive !== undefined ? planData.isActive : true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        dataLimit: formData.isUnlimited
          ? null
          : formData.dataLimit
          ? Math.round(parseFloat(formData.dataLimit) * 1024 * 1024 * 1024)
          : null,
        features: formData.features
          ? formData.features.split(',').map((f) => f.trim()).filter((f) => f)
          : [],
      };
      await onSubmit(submitData);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{planData ? 'Edit Plan' : 'Create New Plan'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Plan Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Basic, Premium, Enterprise"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Plan description..."
            />
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="isUnlimited"
                  checked={formData.isUnlimited}
                  onChange={handleChange}
                />
                Unlimited Data
              </label>
            </div>

            {!formData.isUnlimited && (
              <div className="form-group">
                <label htmlFor="dataLimit">Data Limit (GB) *</label>
                <input
                  type="number"
                  id="dataLimit"
                  name="dataLimit"
                  value={formData.dataLimit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required={!formData.isUnlimited}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">Price</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="MMK">MMK</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="billingCycle">Billing Cycle</label>
              <select
                id="billingCycle"
                name="billingCycle"
                value={formData.billingCycle}
                onChange={handleChange}
              >
                <option value="1-month">1 Month</option>
                <option value="2-months">2 Months</option>
                <option value="3-months">3 Months</option>
                <option value="6-months">6 Months</option>
                <option value="1-year">1 Year</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="expiryMonths">Expiry Months (for device setup)</label>
              <input
                type="number"
                id="expiryMonths"
                name="expiryMonths"
                value={formData.expiryMonths}
                onChange={handleChange}
                min="1"
                step="1"
              />
              <small>Default expiry period when this plan is selected during device setup</small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="features">Features (comma-separated)</label>
            <input
              type="text"
              id="features"
              name="features"
              value={formData.features}
              onChange={handleChange}
              placeholder="e.g., Fast speeds, 24/7 support, Multiple devices"
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              Active
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : planData ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanForm;
