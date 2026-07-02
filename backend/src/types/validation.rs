use validator::{ValidateEmail, ValidateLength, ValidationError, ValidationErrors};

pub(super) fn validate_length_field(
    value: &str,
    field: &'static str,
    min: u64,
    max: u64,
    errors: &mut ValidationErrors,
) {
    if value.validate_length(Some(min), Some(max), None) {
        return;
    }

    let mut error = ValidationError::new("length");
    error.add_param("min".into(), &min);
    error.add_param("max".into(), &max);
    errors.add(field, error);
}

pub(super) fn validate_email_field(
    value: &str,
    field: &'static str,
    errors: &mut ValidationErrors,
) {
    if !value.validate_email() {
        errors.add(field, ValidationError::new("email"));
    }
}

pub(super) fn finish_validation(errors: ValidationErrors) -> Result<(), ValidationErrors> {
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
