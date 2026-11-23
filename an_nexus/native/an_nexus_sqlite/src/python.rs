//! PyO3 bindings for the Vault Query Plane hardened SQLite handles.

use crate::{install_readonly_authorizer, open_readonly_memory, open_readonly_vault_handle};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::{PyList, PyTuple};
use rusqlite::{params_from_iter, types::ValueRef, Connection};

fn to_py_err(e: impl std::fmt::Display) -> PyErr {
    PyRuntimeError::new_err(e.to_string())
}

fn value_ref_to_py(py: Python<'_>, v: ValueRef<'_>) -> PyResult<PyObject> {
    match v {
        ValueRef::Null => Ok(py.None()),
        ValueRef::Integer(i) => Ok(i.into_py(py)),
        ValueRef::Real(f) => Ok(f.into_py(py)),
        ValueRef::Text(t) => {
            let s = std::str::from_utf8(t).map_err(|e| PyValueError::new_err(e.to_string()))?;
            Ok(s.into_py(py))
        }
        ValueRef::Blob(b) => Ok(b.into_py(py)),
    }
}

/// Hardened read-only vault connection exposed to Python.
#[pyclass(name = "VaultConnection", module = "an_nexus_sqlite")]
pub struct PyVaultConnection {
    conn: Connection,
}

#[pymethods]
impl PyVaultConnection {
    /// Execute a statement that must not return rows (still subject to VDBE deny).
    fn execute_readonly(&self, sql: &str) -> PyResult<usize> {
        let n = self.conn.execute(sql, []).map_err(to_py_err)?;
        Ok(n)
    }

    /// Query a single scalar value.
    fn query_scalar(&self, py: Python<'_>, sql: &str) -> PyResult<PyObject> {
        let mut stmt = self.conn.prepare(sql).map_err(to_py_err)?;
        let mut rows = stmt.query([]).map_err(to_py_err)?;
        let row = rows
            .next()
            .map_err(to_py_err)?
            .ok_or_else(|| PyValueError::new_err("query returned no rows"))?;
        let v = row.get_ref(0).map_err(to_py_err)?;
        value_ref_to_py(py, v)
    }

    /// Query all rows; each row is a tuple of Python values.
    fn query_all(&self, py: Python<'_>, sql: &str) -> PyResult<PyObject> {
        let mut stmt = self.conn.prepare(sql).map_err(to_py_err)?;
        let col_count = stmt.column_count();
        let mut rows = stmt.query([]).map_err(to_py_err)?;
        let list = PyList::empty_bound(py);
        while let Some(row) = rows.next().map_err(to_py_err)? {
            let mut vals: Vec<PyObject> = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let v = row.get_ref(i).map_err(to_py_err)?;
                vals.push(value_ref_to_py(py, v)?);
            }
            let tup = PyTuple::new_bound(py, &vals);
            list.append(tup)?;
        }
        Ok(list.into())
    }

    /// True if this handle is living under the hardened authorizer path.
    #[getter]
    fn is_hardened(&self) -> bool {
        true
    }

    fn __repr__(&self) -> &str {
        "VaultConnection(hardened=true, query_only=true)"
    }
}

/// Open a hardened read-only vault database at `path`.
#[pyfunction]
fn open_readonly_vault(path: &str) -> PyResult<PyVaultConnection> {
    let conn = open_readonly_vault_handle(path).map_err(to_py_err)?;
    Ok(PyVaultConnection { conn })
}

/// Open a hardened in-memory connection (primarily for tests).
#[pyfunction]
fn open_readonly_memory_py() -> PyResult<PyVaultConnection> {
    let conn = open_readonly_memory().map_err(to_py_err)?;
    Ok(PyVaultConnection { conn })
}

/// Install the readonly authorizer on a temporary probe (API surface for parity tests).
#[pyfunction]
fn authorizer_allow_list() -> Vec<&'static str> {
    vec!["Select", "Read", "Function", "Recursive", "Transaction", "Savepoint"]
}

/// Module version string.
#[pyfunction]
fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[pymodule]
fn an_nexus_sqlite(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<PyVaultConnection>()?;
    m.add_function(wrap_pyfunction!(open_readonly_vault, m)?)?;
    m.add_function(wrap_pyfunction!(open_readonly_memory_py, m)?)?;
    // Alias matching Python naming used in tests/docs
    m.add_function(wrap_pyfunction!(open_readonly_memory_py, m)?)?;
    m.add_function(wrap_pyfunction!(authorizer_allow_list, m)?)?;
    m.add_function(wrap_pyfunction!(version, m)?)?;
    // Export preferred names
    m.add("open_readonly_memory", m.getattr("open_readonly_memory_py")?)?;
    let _ = install_readonly_authorizer; // keep used for docs/link
    Ok(())
}
