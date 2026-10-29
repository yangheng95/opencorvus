// Take a look at the license at the top of the repository in the LICENSE file.

use std::vec::Vec;

use libc::size_t;

use crate::{translate::*, Checksum};

impl Checksum {
    #[doc(alias = "g_checksum_get_digest")]
    #[doc(alias = "get_digest")]
    pub fn digest(self) -> Vec<u8> {
        unsafe {
            //Don't forget update when `ChecksumType` contains type bigger that Sha512.
            let mut digest_len: size_t = 512 / 8;
            let mut vec = Vec::with_capacity(digest_len as _);

            ffi::g_checksum_get_digest(
                mut_override(self.to_glib_none().0),
                vec.as_mut_ptr(),
                &mut digest_len,
            );

            vec.set_len(digest_len);
            vec
        }
    }

    #[doc(alias = "g_checksum_get_string")]
    #[doc(alias = "get_string")]
    pub fn string(self) -> Option<String> {
        unsafe {
            from_glib_none(ffi::g_checksum_get_string(mut_override(
                self.to_glib_none().0,
            )))
        }
    }
}
