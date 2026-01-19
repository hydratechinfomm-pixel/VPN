import React, { useState, useEffect } from 'react';
import { plansAPI } from '../api';
import PlanForm from '../components/PlanForm';
import '../styles/plans.css';

const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await plansAPI.getAll();
      const plansList = Array.isArray(response) ? response : response?.plans || [];
      setPlans(plansList);
    } catch (err) {
      setError('Failed to load plans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      await plansAPI.delete(planId);
      setPlans((prev) => prev.filter((p) => p._id !== planId));
    } catch (err) {
      setError(err.response?.error || 'Failed to delete plan');
      alert(err.response?.error || 'Failed to delete plan');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingPlan) {
        await plansAPI.update(editingPlan._id, formData);
        setPlans((prev) =>
          prev.map((p) => (p._id === editingPlan._id ? { ...p, ...formData } : p))
        );
      } else {
        const response = await plansAPI.create(formData);
        const newPlan = response.plan || response;
        setPlans((prev) => [...prev, newPlan]);
      }
      setShowForm(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      setError(editingPlan ? 'Failed to update plan' : 'Failed to create plan');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'Unlimited';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  if (loading) {
    return <div className="loading-screen">Loading plans...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Plans Management</h1>
        <button className="btn-primary" onClick={handleAddPlan}>
          + Create Plan
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Data Limit</th>
              <th>Price</th>
              <th>Billing Cycle</th>
              <th>Active Devices</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  No plans found. Create your first plan!
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan._id}>
                  <td>{plan.name}</td>
                  <td>{plan.description || 'N/A'}</td>
                  <td>
                    <span className={plan.dataLimit?.isUnlimited ? 'data-limit-display unlimited' : 'data-limit-display'}>
                      {plan.dataLimit?.isUnlimited
                        ? 'Unlimited'
                        : formatBytes(plan.dataLimit?.bytes)}
                    </span>
                  </td>
                  <td>
                    <span className={plan.price > 0 ? 'price-display' : 'price-display free'}>
                      {plan.price > 0
                        ? `${plan.currency || 'USD'} ${plan.price}`
                        : 'Free'}
                    </span>
                  </td>
                  <td>{plan.billingCycle || 'N/A'}</td>
                  <td>{plan.stats?.activeDevices || 0}</td>
                  <td>
                    <span
                      className={`status-badge status-${plan.isActive ? 'active' : 'inactive'}`}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => handleEditPlan(plan)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDeletePlan(plan._id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PlanForm
          planData={editingPlan}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
};

export default PlansPage;
