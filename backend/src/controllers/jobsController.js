'use strict';

function createJobsController({ JobModel }) {
  async function get(req, res) {
    const job = await JobModel.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  }

  return { get };
}

module.exports = { createJobsController };
