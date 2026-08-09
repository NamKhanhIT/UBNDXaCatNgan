using System.Collections.Generic;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class Role : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty; // e.g. BiThu, ChuTichUBND, PhoChuTichUBND, TruongPhong, PhoPhong, ChuyenVien, ChuTichHDND
        public string Description { get; set; } = string.Empty;
        public int RankLevel { get; set; } = 1; // 1: Chủ tịch/Bí thư, 2: Phó Chủ tịch, 3: Trưởng phòng, 4: Phó phòng, 5: Chuyên viên
        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }
}
